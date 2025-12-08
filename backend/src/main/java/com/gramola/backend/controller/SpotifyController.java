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

    // 1. Pide la URL (Ahora requiere barId)
    @GetMapping("/auth-url")
    public ResponseEntity<?> getAuthUrl(@RequestParam Long barId) {
        return ResponseEntity.ok(Collections.singletonMap("url", spotifyService.getAuthorizationUrl(barId)));
    }

    // 2. Callback (Lee el 'state' para saber qué bar es)
    @GetMapping("/callback")
    public RedirectView callback(@RequestParam String code, @RequestParam String state) {
        try {
            Long barId = Long.valueOf(state);
            spotifyService.exchangeCodeForToken(code, barId);
            // Redirige al frontend limpio, ya no hace falta pasar token por URL insegura
            // porque el frontend lo pedirá al endpoint /token
            return new RedirectView("http://localhost:4200/gramola?status=success");
        } catch (Exception e) {
            return new RedirectView("http://localhost:4200/gramola?status=error");
        }
    }

    // 3. Endpoint para que el SDK de Angular obtenga el token
    @GetMapping("/token")
    public ResponseEntity<?> getToken(@RequestParam Long barId) {
        try {
            // Esto refrescará el token si es necesario antes de dárselo al frontend
            String token = spotifyService.getAccessTokenForBar(barId);
            return ResponseEntity.ok(Collections.singletonMap("access_token", token));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    // 4. Buscar
    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam String q, @RequestParam Long barId) {
        return ResponseEntity.ok(spotifyService.searchTracks(q, barId));
    }
    
    // 5. Reproducir (Proxy para evitar problemas CORS en frontend)
    @PostMapping("/play")
    public ResponseEntity<?> play(@RequestBody Map<String, Object> payload) {
        Long barId = Long.valueOf(payload.get("barId").toString());
        String deviceId = (String) payload.get("deviceId");
        String spotifyId = (String) payload.get("spotifyId");
        
        try {
            spotifyService.playTrack("spotify:track:" + spotifyId, deviceId, barId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }
}