package com.gramola.backend.controller;

import com.gramola.backend.service.SpotifyService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;

import java.util.Collections;

@RestController
@RequestMapping("/api/spotify")
@CrossOrigin(origins = "http://localhost:4200")
public class SpotifyController {

    @Autowired
    private SpotifyService spotifyService;

    // Endpoint 1: Pide la URL de autenticación al servicio
    @GetMapping("/auth-url")
    public ResponseEntity<?> getAuthUrl() {
        return ResponseEntity.ok(Collections.singletonMap("url", spotifyService.getAuthorizationUrl()));
    }

    // Endpoint 2: Recibe el código de Spotify (es la Redirect URI)
    @GetMapping("/callback")
    public RedirectView callback(@RequestParam String code) {
        spotifyService.exchangeCodeForToken(code);
        
        // Redirigimos a Angular (Frontend) indicando que la conexión fue exitosa
        return new RedirectView("http://localhost:4200/gramola?status=connected");
    }

    // Endpoint 3: Buscar canciones
    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam String q) {
        // LOGGING: Muestra que la petición de búsqueda ha llegado al backend
        System.out.println("-> Petición de búsqueda recibida. Query: " + q); 
        try {
            return ResponseEntity.ok(spotifyService.searchTracks(q));
        } catch (Exception e) {
            // LOGGING: Muestra si hay un error al procesar la búsqueda
            System.err.println("-> Error procesando la búsqueda: " + e.getMessage());
            return ResponseEntity.status(401).body(Collections.singletonMap("error", e.getMessage()));
        }
    }
}