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
import java.util.Collections;
import java.util.HashMap;
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

    public String getAuthorizationUrl(Long barId) {
        String scope = "streaming user-read-private user-read-email user-modify-playback-state user-read-playback-state playlist-read-private";
        return "https://accounts.spotify.com/authorize" + 
                "?client_id=" + clientId +
                "&response_type=code" +
                "&redirect_uri=" + redirectUri +
                "&scope=" + scope +
                "&state=" + barId;
    }

    public void exchangeCodeForToken(String code, Long barId) {
        processTokenRequest(code, null, "authorization_code", barId);
    }

    public String getAccessTokenForBar(Long barId) {
        Bar bar = barRepository.findById(barId).orElseThrow(() -> new RuntimeException("Bar no encontrado"));
        
        if (bar.getSpotifyRefreshToken() == null) {
            throw new RuntimeException("El bar no está conectado a Spotify");
        }

        if (bar.getSpotifyTokenExpiresAt() == null || LocalDateTime.now().isAfter(bar.getSpotifyTokenExpiresAt())) {
            refreshAccessToken(bar);
        }
        return bar.getSpotifyAccessToken();
    }

    private void refreshAccessToken(Bar bar) {
        processTokenRequest(null, bar.getSpotifyRefreshToken(), "refresh_token", bar.getId());
    }

    private void processTokenRequest(String code, String refreshToken, String grantType, Long barId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth(clientId, clientSecret);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", grantType);
        if (code != null) body.add("code", code);
        if (refreshToken != null) body.add("refresh_token", refreshToken);
        body.add("redirect_uri", redirectUri);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity("https://accounts.spotify.com/api/token", request, Map.class);
            Map<String, Object> resp = response.getBody();
            
            if (resp != null) {
                String newAccessToken = (String) resp.get("access_token");
                Integer expiresIn = (Integer) resp.get("expires_in");
                if (expiresIn == null) expiresIn = 3600;

                Bar bar = barRepository.findById(barId).orElseThrow();
                bar.setSpotifyAccessToken(newAccessToken);
                bar.setSpotifyTokenExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));
                if (resp.containsKey("refresh_token")) {
                    bar.setSpotifyRefreshToken((String) resp.get("refresh_token"));
                }
                barRepository.save(bar);
            }
        } catch (Exception e) {
            System.err.println("Error Token Spotify: " + e.getMessage());
            throw new RuntimeException("Error conectando con Spotify");
        }
    }

    // --- BÚSQUEDA ---
    public Object search(String query, String type, Long barId) {
        String token = getAccessTokenForBar(barId);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        HttpEntity<String> entity = new HttpEntity<>(headers);

        String url = UriComponentsBuilder.fromUriString("https://api.spotify.com/v1/search") 
                .queryParam("q", query)      
                .queryParam("type", type) 
                .queryParam("limit", 10)
                .toUriString();             

        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
        return response.getBody();
    }

    // --- NUEVO: OBTENER PLAYLIST POR ID ---
    public Object getPlaylist(String playlistId, Long barId) {
        String token = getAccessTokenForBar(barId);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        HttpEntity<String> entity = new HttpEntity<>(headers);

        String url = "https://api.spotify.com/v1/playlists/" + playlistId;

        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
        return response.getBody();
    }
    
    // --- REPRODUCCIÓN (SIN TRY-CATCH) ---
    // IMPORTANTE: Hemos quitado el try-catch para que si falla, el Controller se entere
    // y devuelva un error al Frontend.
    public void playTrack(String trackUri, String deviceId, Long barId) {
        String token = getAccessTokenForBar(barId);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new HashMap<>();
        body.put("uris", Collections.singletonList(trackUri));

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        
        String url = "https://api.spotify.com/v1/me/player/play?device_id=" + deviceId;
        restTemplate.put(url, request);
        System.out.println("▶️ REAL: Reproduciendo " + trackUri);
    }

    public void playContext(String contextUri, String deviceId, Long barId, String offsetUri) {
        String token = getAccessTokenForBar(barId);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new HashMap<>();
        body.put("context_uri", contextUri);
        
        if (offsetUri != null && !offsetUri.isEmpty()) {
            body.put("offset", Collections.singletonMap("uri", offsetUri));
        }

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        String url = "https://api.spotify.com/v1/me/player/play?device_id=" + deviceId;
        restTemplate.put(url, request);
        System.out.println("▶️ REAL: Reproduciendo Contexto " + contextUri);
    }
}