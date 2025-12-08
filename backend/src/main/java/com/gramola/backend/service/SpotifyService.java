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

    // 1. Generar URL de Login (Añadimos 'streaming' que es OBLIGATORIO para el SDK)
    // Pasamos el barId en el "state" para saber quién se está logueando a la vuelta
    public String getAuthorizationUrl(Long barId) {
        String scope = "streaming user-read-private user-read-email user-modify-playback-state user-read-playback-state";
        
        return "https://accounts.spotify.com/authorize" + 
                "?client_id=" + clientId +
                "&response_type=code" +
                "&redirect_uri=" + redirectUri +
                "&scope=" + scope +
                "&state=" + barId; // Guardamos el ID del bar en el flujo OAuth
    }

    // 2. Canjear el código por tokens y GUARDARLOS EN BD
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
                // El refresh token es crucial para mantener la sesión viva meses
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

    // 3. Obtener un token válido (Refrescándolo si ha caducado)
    public String getAccessTokenForBar(Long barId) {
        Bar bar = barRepository.findById(barId).orElseThrow(() -> new RuntimeException("Bar no encontrado"));
        
        if (bar.getSpotifyRefreshToken() == null) {
            throw new RuntimeException("Bar no conectado a Spotify");
        }

        // Si el token ha caducado (o le quedan menos de 5 min), lo renovamos
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
                
                // A veces Spotify rota el refresh token también
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

    // 4. Buscar canciones (Usando el token del bar)
    public Object searchTracks(String query, Long barId) {
        String token = getAccessTokenForBar(barId); // Esto garantiza que el token es válido

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        HttpEntity<String> entity = new HttpEntity<>(headers);

        String url = UriComponentsBuilder.fromUriString("https://api.spotify.com/v1/search") 
                .queryParam("q", query)      
                .queryParam("type", "track") 
                .queryParam("limit", 10)
                .toUriString();             

        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
        return response.getBody(); 
    }
    
    // 5. Reproducir canción en el dispositivo Web SDK
    public void playTrack(String trackUri, String deviceId, Long barId) {
        String token = getAccessTokenForBar(barId);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        
        // Body: { "uris": ["spotify:track:xyz"] }
        Map<String, Object> body = Map.of("uris", new String[]{trackUri});
        
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        
        // Llamada a la API de Spotify Player
        restTemplate.put("https://api.spotify.com/v1/me/player/play?device_id=" + deviceId, request);
    }
}