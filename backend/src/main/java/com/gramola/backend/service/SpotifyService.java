/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * 'SpotifyService' es el adaptador de integración con el mundo exterior. 
 * Su responsabilidad es encapsular TODA la comunicación con la API de Spotify.
 *
 * * PUNTOS CLAVE:
 * 1. GESTIÓN DE OAUTH 2.0 (Seguridad):
 * Implementa el flujo completo de autorización estándar:
 * - Generación de URL de login ('getAuthorizationUrl').
 * - Intercambio de Código por Token ('exchangeCodeForToken').
 * - Renovación automática de tokens caducados ('refreshAccessToken').
 * Esto permite que la app funcione "eternamente" sin que el usuario se reloguee.
 *
 * 2. CLIENTE HTTP (RestTemplate):
 * Utilizamos 'RestTemplate' para realizar las peticiones HTTP (GET/POST/PUT) 
 * a los servidores de Spotify, manejando cabeceras y parámetros.
 *
 * 3. CONTROL DE REPRODUCCIÓN:
 * Permite controlar el reproductor remotamente (Play/Pause/Contexto) actuando 
 * como un mando a distancia lógico.
 * ======================================================================================
 */

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

    // --- CONFIGURACIÓN (application.properties) ---
    // Inyectamos las credenciales sensibles desde el fichero de configuración
    // para no tenerlas escritas en el código (Buena práctica de seguridad).
    @Value("${spotify.client.id}")
    private String clientId;

    @Value("${spotify.client.secret}")
    private String clientSecret;

    @Value("${spotify.redirect.uri}")
    private String redirectUri;

    @Autowired
    private BarRepository barRepository;

    // Cliente HTTP síncrono para llamar a APIs externas
    private final RestTemplate restTemplate = new RestTemplate();

    // --- 1. FLUJO DE AUTORIZACIÓN (Paso 1) ---
    // Genera el link donde el usuario pincha para decir "Acepto" en la web de Spotify.
    public String getAuthorizationUrl(Long barId) {
        // Scopes: Permisos específicos que pedimos al usuario (controlar música, ver email...)
        String scope = "streaming user-read-private user-read-email user-modify-playback-state user-read-playback-state playlist-read-private";
        return "https://accounts.spotify.com/authorize" + 
                "?client_id=" + clientId +
                "&response_type=code" +
                "&redirect_uri=" + redirectUri +
                "&scope=" + scope +
                "&state=" + barId; // 'state' nos ayuda a recordar qué bar está logueándose
    }

    // --- 2. INTERCAMBIO DE CÓDIGO (Paso 2) ---
    // Cuando el usuario vuelve de Spotify, trae un "code". Aquí lo canjeamos por el Token real.
    public void exchangeCodeForToken(String code, Long barId) {
        processTokenRequest(code, null, "authorization_code", barId);
    }

    // --- 3. OBTENCIÓN INTELIGENTE DE TOKENS ---
    // Este método es CRÍTICO. Antes de devolver un token, verifica si ha caducado.
    // Si ha caducado, lo renueva automáticamente. El resto de la app solo llama a esto
    // y se olvida de la complejidad de la renovación.
    public String getAccessTokenForBar(Long barId) {
        Bar bar = barRepository.findById(barId).orElseThrow(() -> new RuntimeException("Bar no encontrado"));
        
        if (bar.getSpotifyRefreshToken() == null) {
            throw new RuntimeException("El bar no está conectado a Spotify");
        }

        // Si la fecha actual es posterior a la de expiración, renovamos.
        if (bar.getSpotifyTokenExpiresAt() == null || LocalDateTime.now().isAfter(bar.getSpotifyTokenExpiresAt())) {
            refreshAccessToken(bar);
        }
        return bar.getSpotifyAccessToken();
    }

    private void refreshAccessToken(Bar bar) {
        processTokenRequest(null, bar.getSpotifyRefreshToken(), "refresh_token", bar.getId());
    }

    // Lógica común para pedir tokens (tanto iniciales como renovaciones)
    private void processTokenRequest(String code, String refreshToken, String grantType, Long barId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth(clientId, clientSecret); // Autenticación básica (Client ID + Secret)

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
                if (expiresIn == null) expiresIn = 3600; // 1 hora por defecto

                Bar bar = barRepository.findById(barId).orElseThrow();
                bar.setSpotifyAccessToken(newAccessToken);
                // Calculamos la fecha exacta de muerte del token
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
    // Actúa como un proxy: Frontend -> Backend -> Spotify API
    public Object search(String query, String type, Long barId) {
        String token = getAccessTokenForBar(barId);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token); // Authorization: Bearer <token>
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
    
    // --- REPRODUCCIÓN (CONTROL DE DISPOSITIVO) ---
    // Nota: Aquí no capturamos la excepción para que el Controlador se entere si falla
    // y pueda avisar al Frontend (útil si el dispositivo Spotify no está activo).
    public void playTrack(String trackUri, String deviceId, Long barId) {
        String token = getAccessTokenForBar(barId);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new HashMap<>();
        body.put("uris", Collections.singletonList(trackUri)); // "uris" espera un array

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
        body.put("context_uri", contextUri); // Reproducir álbum o playlist entera
        
        if (offsetUri != null && !offsetUri.isEmpty()) {
            body.put("offset", Collections.singletonMap("uri", offsetUri));
        }

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        String url = "https://api.spotify.com/v1/me/player/play?device_id=" + deviceId;
        restTemplate.put(url, request);
        System.out.println("▶️ REAL: Reproduciendo Contexto " + contextUri);
    }
}