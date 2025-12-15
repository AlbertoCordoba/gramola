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

    // 1. LOGIN
    public String getAuthorizationUrl(Long barId) {
        String scope = "streaming user-read-private user-read-email user-modify-playback-state user-read-playback-state playlist-read-private";
        
        return "https://accounts.spotify.com/authorize" + 
                "?client_id=" + clientId +
                "&response_type=code" +
                "&redirect_uri=" + redirectUri +
                "&scope=" + scope +
                "&state=" + barId;
    }

    // 2. CANJEAR TOKEN
    public void exchangeCodeForToken(String code, Long barId) {
        processTokenRequest(code, null, "authorization_code", barId);
    }

    // 3. GESTIÓN DEL TOKEN
    public String getAccessTokenForBar(Long barId) {
        Bar bar = barRepository.findById(barId).orElseThrow(() -> new RuntimeException("Bar no encontrado"));
        
        if (bar.getSpotifyRefreshToken() == null) {
            throw new RuntimeException("Bar no conectado a Spotify");
        }

        // Si la fecha es nula o ya pasó, refrescamos.
        // NOTA: Gracias al parche, esto debería ocurrir solo cada hora.
        if (bar.getSpotifyTokenExpiresAt() == null || LocalDateTime.now().isAfter(bar.getSpotifyTokenExpiresAt())) {
            System.out.println("Token caducado. Intentando refrescar...");
            refreshAccessToken(bar);
        }

        return bar.getSpotifyAccessToken();
    }

    private void refreshAccessToken(Bar bar) {
        processTokenRequest(null, bar.getSpotifyRefreshToken(), "refresh_token", bar.getId());
    }

    // Lógica común para pedir token (Login o Refresh) con PARCHE DE 1 HORA
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

                if (newAccessToken == null) {
                    System.err.println("¡ERROR! Spotify devolvió un token nulo.");
                    return; 
                }

                // --- PARCHE DE RENDIMIENTO ---
                // Si expires_in es nulo o menor a 1 hora, forzamos 3600 segundos
                if (expiresIn == null || expiresIn < 3600) {
                    expiresIn = 3600;
                }

                Bar bar = barRepository.findById(barId).orElseThrow();
                bar.setSpotifyAccessToken(newAccessToken);
                bar.setSpotifyTokenExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));
                
                if (resp.containsKey("refresh_token")) {
                    bar.setSpotifyRefreshToken((String) resp.get("refresh_token"));
                }
                
                barRepository.save(bar);
                System.out.println("Token actualizado. Válido por " + expiresIn + "s");
            }
        } catch (Exception e) {
            System.err.println("Error obteniendo token: " + e.getMessage());
        }
    }

    // 4. BUSCAR
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

        System.out.println("Iniciando búsqueda externa: " + query);
        long start = System.currentTimeMillis();
        
        try {
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            System.out.println("Búsqueda terminada en: " + (System.currentTimeMillis() - start) + "ms");
            return response.getBody();
        } catch (Exception e) {
            System.err.println("Error en búsqueda externa: " + e.getMessage());
            return Map.of("error", e.getMessage());
        }
    }
    
    // 5. REPRODUCIR TRACK (Para canciones sueltas / pedidos)
    public void playTrack(String trackUri, String deviceId, Long barId) {
        String token = getAccessTokenForBar(barId);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        
        Map<String, Object> body = Map.of("uris", new String[]{trackUri});
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        
        restTemplate.put("https://api.spotify.com/v1/me/player/play?device_id=" + deviceId, request);
    }

    // 6. REPRODUCIR CONTEXTO (PLAYLIST) CON OFFSET
    public void playContext(String contextUri, String deviceId, Long barId, String offsetUri) {
        String token = getAccessTokenForBar(barId);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        
        Map<String, Object> body = new HashMap<>();
        body.put("context_uri", contextUri);
        
        // Si tenemos un punto de retorno guardado, lo usamos
        if (offsetUri != null && !offsetUri.isEmpty()) {
            body.put("offset", Map.of("uri", offsetUri));
        }

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        restTemplate.put("https://api.spotify.com/v1/me/player/play?device_id=" + deviceId, request);
    }
}