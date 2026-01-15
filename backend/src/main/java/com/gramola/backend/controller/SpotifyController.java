package com.gramola.backend.controller;

import com.gramola.backend.service.SpotifyService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api/spotify")
@CrossOrigin(origins = {"http://localhost:4200", "http://127.0.0.1:4200"})
public class SpotifyController {

    @Autowired
    private SpotifyService spotifyService;

    @GetMapping("/auth-url")
    public ResponseEntity<?> getAuthUrl(@RequestParam Long barId) {
        return ResponseEntity.ok(Collections.singletonMap("url", spotifyService.getAuthorizationUrl(barId)));
    }

    @GetMapping("/callback")
    public ResponseEntity<?> callback(@RequestParam String code, @RequestParam String state) {
        try {
            Long barId = Long.valueOf(state);
            spotifyService.exchangeCodeForToken(code, barId);
            return ResponseEntity.ok(Collections.singletonMap("mensaje", "Conectado correctamente"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
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

    // ENDPOINT PARA CARGA DE DISPOSITIVOS
    @GetMapping("/devices")
    public ResponseEntity<?> getDevices(@RequestParam Long barId) {
        try {
            return ResponseEntity.ok(spotifyService.getDevices(barId));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam String q, @RequestParam Long barId, @RequestParam(defaultValue = "track") String type) {
        return ResponseEntity.ok(spotifyService.search(q, type, barId));
    }

    @GetMapping("/playlist")
    public ResponseEntity<?> getPlaylist(@RequestParam String id, @RequestParam Long barId) {
        try {
            return ResponseEntity.ok(spotifyService.getPlaylist(id, barId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }
    
    @PostMapping("/play")
    public ResponseEntity<?> play(@RequestBody Map<String, Object> payload) {
        try {
            Long barId = Long.valueOf(payload.get("barId").toString());
            String deviceId = (String) payload.get("deviceId");
            
            if (payload.containsKey("contextUri")) {
                String offsetUri = (String) payload.get("offsetUri");
                spotifyService.playContext((String) payload.get("contextUri"), deviceId, barId, offsetUri);
            } else {
                String spotifyId = (String) payload.get("spotifyId");
                String trackUri = spotifyId.startsWith("spotify:track:") ? spotifyId : "spotify:track:" + spotifyId;
                spotifyService.playTrack(trackUri, deviceId, barId);
            }
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }
}