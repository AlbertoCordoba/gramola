package com.gramola.backend.service;

import com.gramola.backend.model.Bar;
import com.gramola.backend.repository.BarRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDateTime;
import java.util.Map;

@Service
public class SpotifyService {

    @Value("${spotify.client.id}")
    private String clientId;

    @Value("${spotify.client.secret}")
    private String clientSecret;

    @Value("${spotify.redirect.uri}")
    private String redirectUri;

    @Autowired
    private BarRepository barRepository;

    private final RestTemplate restTemplate = new RestTemplate();

    // 1. LOGIN (URL OFICIAL)
    public String getAuthorizationUrl(Long barId) {
        // Importante: 'playlist-read-private' es necesario para buscar tus playlists
        String scope = "streaming user-read-private user-read-email user-modify-playback-state user-read-playback-state playlist-read-private";
        
        return "https://accounts.spotify.com/authorize" + 
                "?client_id=" + clientId +
                "&response_type=code" +
                "&redirect_uri=" + redirectUri +
                "&scope=" + scope +
                "&state=" + barId;
    }

    // 2. CANJEAR TOKEN (URL OFICIAL)
    public void exchangeCodeForToken(String code, Long barId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth(clientId, clientSecret);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "authorization_code");
        body.add("code", code);
        body.add("redirect_uri", redirectUri);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity("https://accounts.spotify.com/api/token", request, Map.class);
            Map<String, Object> resp = response.getBody();
            
            if (resp != null) {
                String accessToken = (String) resp.get("access_token");
                String refreshToken = (String) resp.get("refresh_token");
                Integer expiresIn = (Integer) resp.get("expires_in");

                Bar bar = barRepository.findById(barId).orElseThrow();
                bar.setSpotifyAccessToken(accessToken);
                if (refreshToken != null) {
                    bar.setSpotifyRefreshToken(refreshToken);
                }
                bar.setSpotifyTokenExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));
                
                barRepository.save(bar);
            }
        } catch (Exception e) {
            throw new RuntimeException("Error autenticando con Spotify: " + e.getMessage());
        }
    }

    // 3. GESTIÓN DEL TOKEN
    public String getAccessTokenForBar(Long barId) {
        Bar bar = barRepository.findById(barId).orElseThrow(() -> new RuntimeException("Bar no encontrado"));
        
        if (bar.getSpotifyRefreshToken() == null) {
            throw new RuntimeException("Bar no conectado a Spotify");
        }

        if (bar.getSpotifyTokenExpiresAt() == null || LocalDateTime.now().plusMinutes(5).isAfter(bar.getSpotifyTokenExpiresAt())) {
            refreshAccessToken(bar);
        }

        return bar.getSpotifyAccessToken();
    }

    private void refreshAccessToken(Bar bar) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth(clientId, clientSecret);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "refresh_token");
        body.add("refresh_token", bar.getSpotifyRefreshToken());

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);
        
        try {
            ResponseEntity<Map> response = restTemplate.postForEntity("https://accounts.spotify.com/api/token", request, Map.class);
            Map<String, Object> resp = response.getBody();
            
            if (resp != null) {
                String newAccessToken = (String) resp.get("access_token");
                Integer expiresIn = (Integer) resp.get("expires_in");
                
                if (resp.containsKey("refresh_token")) {
                    bar.setSpotifyRefreshToken((String) resp.get("refresh_token"));
                }

                bar.setSpotifyAccessToken(newAccessToken);
                bar.setSpotifyTokenExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));
                barRepository.save(bar);
            }
        } catch (Exception e) {
            throw new RuntimeException("Error renovando token: " + e.getMessage());
        }
    }

    // 4. BUSCAR (AHORA SOPORTA TRACK O PLAYLIST)
    public Object search(String query, String type, Long barId) {
        String token = getAccessTokenForBar(barId); 
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        HttpEntity<String> entity = new HttpEntity<>(headers);

        String url = UriComponentsBuilder.fromUriString("https://api.spotify.com/v1/search") 
                .queryParam("q", query)      
                .queryParam("type", type) // 'track' o 'playlist'
                .queryParam("limit", 10)
                .toUriString();             

        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
        return response.getBody(); 
    }
    
    // 5. REPRODUCIR CANCIÓN (TRACK)
    public void playTrack(String trackUri, String deviceId, Long barId) {
        String token = getAccessTokenForBar(barId);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        
        Map<String, Object> body = Map.of("uris", new String[]{trackUri});
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        
        // URL para controlar el reproductor
        String url = "https://api.spotify.com/v1/me/player/play?device_id=" + deviceId;
        restTemplate.put(url, request);
    }

    // 6. REPRODUCIR PLAYLIST (CONTEXT) - ¡NUEVO!
    public void playContext(String contextUri, String deviceId, Long barId) {
        String token = getAccessTokenForBar(barId);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        
        // Para playlists usamos "context_uri" en lugar de "uris"
        Map<String, Object> body = Map.of("context_uri", contextUri);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        
        String url = "https://api.spotify.com/v1/me/player/play?device_id=" + deviceId;
        restTemplate.put(url, request);
    }
}