package com.gramola.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class SpotifyService {

    @Value("${spotify.client.id}")
    private String clientId;

    @Value("${spotify.client.secret}")
    private String clientSecret;

    @Value("${spotify.redirect.uri}")
    private String redirectUri;

    // Token de acceso guardado en memoria (se pierde al reiniciar el servidor)
    private String accessToken;

    private final RestTemplate restTemplate = new RestTemplate();

    // 1. Generar URL de Login para Spotify
    public String getAuthorizationUrl() {
        // Scopes necesarios para la funcionalidad básica
        String scope = "user-read-private user-read-email user-modify-playback-state user-read-playback-state";
        
        return "https://accounts.spotify.com/authorize" +
                "?client_id=" + clientId +
                "&response_type=code" +
                "&redirect_uri=" + redirectUri +
                "&scope=" + scope;
    }

    // 2. Canjear el código que nos da Spotify por un Token de acceso real
    public void exchangeCodeForToken(String code) {
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
            if (response.getBody() != null) {
                this.accessToken = (String) response.getBody().get("access_token");
                System.out.println("TOKEN SPOTIFY OBTENIDO: " + this.accessToken);
            }
        } catch (Exception e) {
            System.err.println("Error obteniendo token: " + e.getMessage());
        }
    }

    // 3. Buscar canciones en la API real de Spotify
    public Object searchTracks(String query) {
        if (accessToken == null) {
            throw new RuntimeException("No conectado a Spotify. Pulsa 'Conectar' primero.");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        HttpEntity<String> entity = new HttpEntity<>(headers);

        // Limitamos la búsqueda a 10 canciones
        String url = "https://api.spotify.com/v1/search?q=" + query + "&type=track&limit=10";
        
        // Devolvemos el JSON tal cual nos lo da Spotify
        return restTemplate.exchange(url, HttpMethod.GET, entity, Map.class).getBody();
    }
    
    public boolean isAuthenticated() {
        return accessToken != null;
    }
}