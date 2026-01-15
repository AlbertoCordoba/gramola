package com.gramola.backend.service;

import com.gramola.backend.model.Bar;
import com.gramola.backend.repository.BarRepository;
import com.gramola.backend.util.SimetricCipher; 
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@Service
public class SpotifyService {

    @Value("${spotify.redirect.uri}")
    private String redirectUri;

    @Autowired
    private BarRepository barRepository;

    private final RestTemplate restTemplate = new RestTemplate();

    private String generarStateAleatorio() {
        String caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(10);
        for (int i = 0; i < 10; i++) {
            sb.append(caracteres.charAt(random.nextInt(caracteres.length())));
        }
        return sb.toString();
    }

    public String getAuthorizationUrl(Long barId) {
        Bar bar = barRepository.findById(barId).orElseThrow(() -> new RuntimeException("Bar no encontrado"));
        String clientId = bar.getClientId();
        
        if (clientId == null || clientId.isEmpty()) {
            throw new RuntimeException("El bar no tiene Client ID configurado.");
        }

        String scope = "streaming user-read-private user-read-email user-modify-playback-state user-read-playback-state playlist-read-private";
        
        // 1. Generar y GUARDAR el state
        String stateAleatorio = barId + "_" + generarStateAleatorio();
        
        bar.setTempState(stateAleatorio);
        barRepository.save(bar);

        return UriComponentsBuilder.fromUriString("https://accounts.spotify.com/authorize")
                .queryParam("response_type", "code")
                .queryParam("client_id", clientId)
                .queryParam("scope", scope)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("state", stateAleatorio)
                .build()
                .toUriString();
    }

    // 2. Validar el state recibido
    public void exchangeCodeForToken(String code, Long barId, String stateRecibido) {
        Bar bar = barRepository.findById(barId).orElseThrow(() -> new RuntimeException("Bar no encontrado"));
        
        // SEGURIDAD: Si el state no coincide o está vacío, es un error/ataque
        if (bar.getTempState() == null || !bar.getTempState().equals(stateRecibido)) {
            bar.setTempState(null); // Borrar por seguridad
            barRepository.save(bar);
            throw new SecurityException("State inválido o sesión caducada.");
        }

        // State correcto: Lo borramos y guardamos ANTES de llamar a Spotify
        bar.setTempState(null);
        barRepository.save(bar);

        processTokenRequest(code, null, "authorization_code", bar);
    }

    public String getAccessTokenForBar(Long barId) {
        Bar bar = barRepository.findById(barId).orElseThrow(() -> new RuntimeException("Bar no encontrado"));
        if (bar.getSpotifyRefreshToken() == null) throw new RuntimeException("Bar no conectado a Spotify");
        
        if (bar.getSpotifyTokenExpiresAt() == null || LocalDateTime.now().isAfter(bar.getSpotifyTokenExpiresAt())) {
            processTokenRequest(null, bar.getSpotifyRefreshToken(), "refresh_token", bar);
        }
        return bar.getSpotifyAccessToken();
    }

    private void processTokenRequest(String code, String refreshToken, String grantType, Bar bar) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth(bar.getClientId(), SimetricCipher.decrypt(bar.getClientSecret()));
        
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", grantType);
        if (code != null) body.add("code", code);
        if (refreshToken != null) body.add("refresh_token", refreshToken);
        body.add("redirect_uri", redirectUri);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity("https://accounts.spotify.com/api/token", new HttpEntity<>(body, headers), Map.class);
            Map<String, Object> resp = response.getBody();
            if (resp != null) {
                bar.setSpotifyAccessToken((String) resp.get("access_token"));
                Object expiresIn = resp.get("expires_in");
                if (expiresIn != null) {
                    bar.setSpotifyTokenExpiresAt(LocalDateTime.now().plusSeconds(((Number) expiresIn).longValue()));
                }
                if (resp.containsKey("refresh_token")) {
                    bar.setSpotifyRefreshToken((String) resp.get("refresh_token"));
                }
                barRepository.save(bar);
            }
        } catch (Exception e) { 
            throw new RuntimeException("Error en token de Spotify: " + e.getMessage()); 
        }
    }

    public Object getDevices(Long barId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(getAccessTokenForBar(barId));
        return restTemplate.exchange("https://api.spotify.com/v1/me/player/devices", HttpMethod.GET, new HttpEntity<>(headers), Map.class).getBody();
    }

    public Object search(String query, String type, Long barId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(getAccessTokenForBar(barId));
        String url = UriComponentsBuilder.fromUriString("https://api.spotify.com/v1/search")
                .queryParam("q", query)
                .queryParam("type", type)
                .build()
                .toUriString();
        return restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), Map.class).getBody();
    }

    public Object getPlaylist(String playlistId, Long barId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(getAccessTokenForBar(barId));
        return restTemplate.exchange("https://api.spotify.com/v1/playlists/" + playlistId, HttpMethod.GET, new HttpEntity<>(headers), Map.class).getBody();
    }

    public void playTrack(String trackUri, String deviceId, Long barId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(getAccessTokenForBar(barId));
        Map<String, Object> body = Collections.singletonMap("uris", Collections.singletonList(trackUri));
        String url = "https://api.spotify.com/v1/me/player/play" + (deviceId != null ? "?device_id=" + deviceId : "");
        restTemplate.put(url, new HttpEntity<>(body, headers));
    }

    public void playContext(String contextUri, String deviceId, Long barId, String offsetUri) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(getAccessTokenForBar(barId));
        Map<String, Object> body = new HashMap<>();
        body.put("context_uri", contextUri);
        if (offsetUri != null) body.put("offset", Collections.singletonMap("uri", offsetUri));
        
        String url = "https://api.spotify.com/v1/me/player/play" + (deviceId != null ? "?device_id=" + deviceId : "");
        restTemplate.put(url, new HttpEntity<>(body, headers));
    }
}