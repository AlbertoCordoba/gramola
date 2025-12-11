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

    @GetMapping("/auth-url")
    public ResponseEntity<?> getAuthUrl(@RequestParam Long barId) {
        return ResponseEntity.ok(Collections.singletonMap("url", spotifyService.getAuthorizationUrl(barId)));
    }

    @GetMapping("/callback")
    public RedirectView callback(@RequestParam String code, @RequestParam String state) {
        try {
            Long barId = Long.valueOf(state);
            spotifyService.exchangeCodeForToken(code, barId);
            
            // REDIRECCIÓN CORRECTA: Volver a la pantalla de configuración
            return new RedirectView("http://localhost:4200/config-audio?status=success");
        } catch (Exception e) {
            return new RedirectView("http://localhost:4200/config-audio?status=error");
        }
    }

    @GetMapping("/token")
    public ResponseEntity<?> getToken(@RequestParam Long barId) {
        try {
            String token = spotifyService.getAccessTokenForBar(barId);
            return ResponseEntity.ok(Collections.singletonMap("access_token", token));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    // MODIFICADO: Aceptar parámetro 'type'
    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam String q, @RequestParam Long barId, @RequestParam(defaultValue = "track") String type) {
        return ResponseEntity.ok(spotifyService.search(q, type, barId));
    }
    
    // MODIFICADO: Lógica para reproducir Playlist o Canción
    @PostMapping("/play")
    public ResponseEntity<?> play(@RequestBody Map<String, Object> payload) {
        Long barId = Long.valueOf(payload.get("barId").toString());
        String deviceId = (String) payload.get("deviceId");
        
        try {
            // Si el frontend manda 'contextUri', es una playlist
            if (payload.containsKey("contextUri")) {
                spotifyService.playContext((String) payload.get("contextUri"), deviceId, barId);
            } else {
                // Si manda 'spotifyId', es una canción suelta
                String spotifyId = (String) payload.get("spotifyId");
                spotifyService.playTrack("spotify:track:" + spotifyId, deviceId, barId);
            }
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }
}