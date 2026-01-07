/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * Es el adaptador web para la API de Spotify. Gestiona el flujo de login OAuth 2.0 y
 * actúa como intermediario seguro para búsquedas y reproducción.
 *
 * * PUNTOS CLAVE:
 * 1. FLUJO DE AUTORIZACIÓN (OAuth):
 * - '/auth-url': Inicia el proceso enviando al usuario a la web de Spotify.
 * - '/callback': Recibe al usuario de vuelta con el código de autorización.
 *
 * 2. PROXY DE SEGURIDAD ('/search'):
 * El Frontend nunca llama a Spotify directamente. Llama a este controlador, y es el
 * servidor (Backend) quien tiene el token y hace la llamada real. Esto protege las
 * credenciales y evita problemas de CORS con la API externa.
 *
 * 3. CONTROL DE REPRODUCCIÓN:
 * El endpoint '/play' centraliza la lógica de "qué debe sonar". Sabe distinguir
 * entre una canción suelta (pedido) y una playlist de contexto (ambiente).
 * ======================================================================================
 */

package com.gramola.backend.controller;

import com.gramola.backend.service.SpotifyService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api/spotify")
@CrossOrigin(origins = "http://localhost:4200")
public class SpotifyController {

    @Autowired
    private SpotifyService spotifyService;

    // --- 1. INICIAR LOGIN SPOTIFY ---
    @GetMapping("/auth-url")
    public ResponseEntity<?> getAuthUrl(@RequestParam Long barId) {
        return ResponseEntity.ok(Collections.singletonMap("url", spotifyService.getAuthorizationUrl(barId)));
    }

    // --- 2. CALLBACK (Vuelta de Spotify) ---
    @GetMapping("/callback")
    public RedirectView callback(@RequestParam String code, @RequestParam String state) {
        try {
            Long barId = Long.valueOf(state); // 'state' nos dice qué bar hizo la petición
            spotifyService.exchangeCodeForToken(code, barId);
            // Éxito: Volvemos a la configuración en Angular
            return new RedirectView("http://localhost:4200/config-audio?status=success");
        } catch (Exception e) {
            return new RedirectView("http://localhost:4200/config-audio?status=error");
        }
    }

    // --- OBTENER TOKEN (Para el Web Player SDK) ---
    @GetMapping("/token")
    public ResponseEntity<?> getToken(@RequestParam Long barId) {
        try {
            String token = spotifyService.getAccessTokenForBar(barId);
            return ResponseEntity.ok(Collections.singletonMap("access_token", token));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    // --- BUSCADOR (Proxy) ---
    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam String q, @RequestParam Long barId, @RequestParam(defaultValue = "track") String type) {
        return ResponseEntity.ok(spotifyService.search(q, type, barId));
    }

    // --- IMPORTAR PLAYLIST ---
    @GetMapping("/playlist")
    public ResponseEntity<?> getPlaylist(@RequestParam String id, @RequestParam Long barId) {
        try {
            return ResponseEntity.ok(spotifyService.getPlaylist(id, barId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }
    
    // --- CONTROL REMOTO (Play) ---
    @PostMapping("/play")
    public ResponseEntity<?> play(@RequestBody Map<String, Object> payload) {
        Long barId = Long.valueOf(payload.get("barId").toString());
        String deviceId = (String) payload.get("deviceId");
        
        try {
            if (payload.containsKey("contextUri")) {
                // Modo Ambiente: Reproduce una lista entera
                String offsetUri = (String) payload.get("offsetUri");
                spotifyService.playContext((String) payload.get("contextUri"), deviceId, barId, offsetUri);
            } else {
                // Modo Pedido: Reproduce una canción específica
                String spotifyId = (String) payload.get("spotifyId");
                spotifyService.playTrack("spotify:track:" + spotifyId, deviceId, barId);
            }
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }
}