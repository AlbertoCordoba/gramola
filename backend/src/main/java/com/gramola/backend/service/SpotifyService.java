package com.gramola.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;

@Service
public class SpotifyService {

    @Value("${spotify.client.id}")
    private String clientId;

    @Value("${spotify.client.secret}")
    private String clientSecret;

    @Value("${spotify.redirect.uri}")
    private String redirectUri;

    // Token de acceso guardado en memoria
    private String accessToken;

    private final RestTemplate restTemplate = new RestTemplate();

    // 1. Generar URL de Login para Spotify
    public String getAuthorizationUrl() {
        // Scopes necesarios para la funcionalidad básica
        String scope = "user-read-private user-read-email user-modify-playback-state user-read-playback-state";
        
        // URL de AUTORIZACIÓN (Placeholder 0)
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
            // URL de OBTENER TOKEN (Placeholder 1)
            ResponseEntity<Map> response = restTemplate.postForEntity("https://accounts.spotify.com/api/token", request, Map.class);
            if (response.getBody() != null) {
                this.accessToken = (String) response.getBody().get("access_token");
                System.out.println("TOKEN SPOTIFY OBTENIDO: " + this.accessToken); 
            }
        } catch (Exception e) {
            System.err.println("Error obteniendo token: " + e.getMessage());
            this.accessToken = null;
            throw new RuntimeException("Error en la autenticación con Spotify: " + e.getMessage());
        }
    }

    // 3. Buscar canciones en la API real de Spotify
    public Object searchTracks(String query) {
        if (accessToken == null) {
            throw new RuntimeException("No conectado a Spotify. Pulsa 'Conectar' primero.");
        }

        // LOGGING: Muestra el token usado en la búsqueda
        System.out.println("TOKEN USADO EN BÚSQUEDA: " + accessToken);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        HttpEntity<String> entity = new HttpEntity<>(headers);

        // Uso de UriComponentsBuilder con el marcador de posición de BÚSQUEDA (Placeholder 3)
        // Esto construye y codifica correctamente la URL: /search?q=query&type=track&limit=10
        String url = UriComponentsBuilder.fromUriString("https://api.spotify.com/v1/search") 
                .queryParam("q", query)      
                .queryParam("type", "track") 
                .queryParam("limit", 10)
                .toUriString();             

        // LOGGING: Muestra la URL COMPLETA que se va a llamar
        System.out.println("-> URL de Spotify API generada para llamada: " + url); 

        try {
            // CORRECCIÓN FINAL: Usamos Map.class para que Spring deserialice el JSON de Spotify
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            System.out.println("RESPUESTA SPOTIFY: JSON recibido y PARSEADO a Map correctamente.");
            
            // Retorna el objeto Java (Map), que se convierte en JSON para el frontend
            return response.getBody(); 
        } catch (Exception e) {
            // LOGGING: Muestra si hay un fallo en la comunicación externa con Spotify
            System.err.println("-> ERROR FATAL en llamada externa a Spotify: " + e.getMessage());
            throw new RuntimeException("Error al comunicarse con la API de Spotify.", e);
        }
    }
    
    public boolean isAuthenticated() {
        return accessToken != null;
    }
}