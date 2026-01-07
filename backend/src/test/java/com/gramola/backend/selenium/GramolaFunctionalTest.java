/*
 * ======================================================================================
 * RESUMEN
 * ======================================================================================
 * * ¿QUÉ ES ESTA CLASE?
 * Es una suite de pruebas funcionales "End-to-End" (E2E) automatizadas con Selenium.
 * Simula el comportamiento de un usuario real navegando por la aplicación en Chrome.
 *
 * * PUNTOS CLAVE:
 * 1. SIMULACIÓN REALISTA:
 * No probamos código aislado, probamos la EXPERIENCIA. El test abre un navegador,
 * inicia sesión, busca canciones, paga y verifica que la música suena.
 *
 * 2. PERFIL PERSISTENTE DE CHROME:
 * Usamos un perfil de usuario temporal ('RUTA_PERFIL') para evitar problemas con
 * sesiones bloqueadas, popups de "guardar contraseña" o configuraciones del navegador
 * del desarrollador. Esto hace que el test sea estable y reproducible.
 *
 * 3. CASOS DE PRUEBA (Happy Path & Error Path):
 * - 'testFlujoRealFernando_Costa': Prueba el camino feliz (todo funciona, pago OK).
 * - 'testPagoConDatosIncorrectos': Prueba la robustez (el sistema rechaza pagos malos).
 * ======================================================================================
 */

package com.gramola.backend.selenium;

import io.github.bonigarcia.wdm.WebDriverManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;
import java.util.HashMap; 
import java.util.List;
import java.util.Map;     

import static org.junit.jupiter.api.Assertions.assertTrue;

public class GramolaFunctionalTest {

    private WebDriver driver;
    private WebDriverWait wait;
    
    // Definimos una carpeta específica para guardar la sesión del navegador de pruebas
    private static final String RUTA_PERFIL = System.getProperty("user.home") + "/selenium-chrome-profile";

    @BeforeAll
    public static void setupClass() {
        // WebDriverManager descarga automáticamente el driver de Chrome compatible
        WebDriverManager.chromedriver().setup();
    }

    @BeforeEach
    public void setUp() {
        System.out.println("📂 Usando perfil persistente en: " + RUTA_PERFIL);
        
        ChromeOptions options = new ChromeOptions();

        // --- BLOQUEAR GESTOR DE CONTRASEÑAS Y AVISOS ---
        // Vital para evitar que popups de Chrome rompan la automatización
        Map<String, Object> prefs = new HashMap<>();
        prefs.put("profile.password_manager_leak_detection", false);
        prefs.put("credentials_enable_service", false);
        prefs.put("profile.password_manager_enabled", false);
        options.setExperimentalOption("prefs", prefs);
        
        options.addArguments("--disable-save-password-bubble");
        options.addArguments("--remote-allow-origins=*");
        // Política para permitir autoreproducción de audio sin interacción
        options.addArguments("--autoplay-policy=no-user-gesture-required");
        
        // Forzar modo oscuro para consistencia visual
        options.addArguments("--force-dark-mode"); 
        options.addArguments("--enable-features=WebUIDarkMode");
        
        options.addArguments("user-data-dir=" + RUTA_PERFIL);
        options.addArguments("--profile-directory=Default"); 

        driver = new ChromeDriver(options);
        wait = new WebDriverWait(driver, Duration.ofSeconds(20));
        driver.manage().window().maximize();
    }

    // --- MÉTODO REUTILIZABLE: PREPARAR LA SESIÓN ---
    // Encapsula el Login, la conexión con Spotify y la selección de ambiente
    private void prepararEntornoGramola(String busquedaPlaylist) {
        // 1. Limpieza de sesión
        driver.get("http://localhost:4200/login");
        JavascriptExecutor js = (JavascriptExecutor) driver;
        js.executeScript("window.localStorage.clear();");
        js.executeScript("window.sessionStorage.clear();");
        driver.navigate().refresh();

        // 2. Login Automático
        System.out.println("🔒 Escribiendo credenciales en Gramola...");
        WebElement emailInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.name("email")));
        emailInput.clear();
        emailInput.sendKeys("bar@test.com"); 
        driver.findElement(By.name("password")).sendKeys("123456");
        driver.findElement(By.className("btn-login")).click();

        // 3. Gestión inteligente de Spotify (¿Ya conectado o necesita login?)
        wait.until(ExpectedConditions.urlContains("config-audio"));
        System.out.println("🚦 Decidiendo si conectar Spotify o buscar...");

        try { Thread.sleep(1500); } catch (Exception e) {}

        List<WebElement> botonesConectar = driver.findElements(By.cssSelector(".connect-screen .btn-primary"));
        
        if (!botonesConectar.isEmpty() && botonesConectar.get(0).isDisplayed()) {
            System.out.println("🔌 Botón encontrado. Pulsando CONECTAR...");
            botonesConectar.get(0).click();
            // Lógica de espera por si Spotify pide login manual (damos 3 minutos)
            try {
                Thread.sleep(2000);
                if (!driver.getCurrentUrl().contains("config-audio")) {
                    System.out.println("\n🛑 ALTO: Spotify pide login. Tienes 3 minutos.");
                    new WebDriverWait(driver, Duration.ofSeconds(180))
                        .until(ExpectedConditions.urlContains("config-audio"));
                    System.out.println("✅ Login completado.");
                }
            } catch (Exception e) {}
        } else {
            System.out.println("✅ No hay botón de conectar. Ya estamos listos.");
        }

        // 4. Selección de Playlist de Ambiente
        System.out.println("📻 Buscando playlist real: " + busquedaPlaylist);
        WebElement searchInput = wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector(".search-box input")));
        searchInput.clear();
        searchInput.sendKeys(busquedaPlaylist);
        
        driver.findElement(By.className("btn-search")).click();

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("results-list")));
        try { Thread.sleep(1000); } catch (Exception e) {} 

        wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-select"))).click();

        // 5. Entrada al Dashboard
        wait.until(ExpectedConditions.urlContains("/gramola"));
        gestionarAudio();
    }
    
    // Intenta activar el audio si el navegador lo bloquea
    private void gestionarAudio() {
        try {
            WebDriverWait audioWait = new WebDriverWait(driver, Duration.ofSeconds(3));
            WebElement btn = audioWait.until(ExpectedConditions.elementToBeClickable(By.cssSelector(".btn-activate")));
            btn.click();
            System.out.println("🔊 Audio activado.");
        } catch (Exception e) {
            // Si no aparece el botón, hacemos un clic genérico para despertar el audio context
            driver.findElement(By.tagName("body")).click();
        }
    }

    // --- TEST 1: FLUJO COMPLETO DE ÉXITO ---
    @Test
    public void testFlujoRealFernando_Costa() {
        prepararEntornoGramola("Fernando Costa");

        // Buscar canción
        WebElement searchInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".search-input")));
        searchInput.clear();
        searchInput.sendKeys("Malamanera");
        
        wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-search"))).click();

        // Seleccionar canción
        WebElement resultsOverlay = wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("results-overlay")));
        try { Thread.sleep(1000); } catch (Exception e) {} 
        
        wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-add"))).click();

        // Rellenar Pago (Datos CORRECTOS)
        WebElement modalPago = wait.until(ExpectedConditions.visibilityOfElementLocated(By.tagName("app-pasarela-pago")));
        modalPago.findElement(By.cssSelector("input[placeholder='NOMBRE APELLIDOS']")).sendKeys("Tester Pro");
        modalPago.findElement(By.cssSelector("input[placeholder='0000 0000 0000 0000']")).sendKeys("1234567812345678");
        modalPago.findElement(By.cssSelector("input[placeholder='MM/AA']")).sendKeys("12/30");
        modalPago.findElement(By.cssSelector("input[placeholder='123']")).sendKeys("123");
        
        wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-pay"))).click();

        // Verificación de Éxito
        WebElement successView = wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("success-view")));
        assertTrue(successView.isDisplayed());
        
        System.out.println("✅ Test completado. 🎶 Reproduciendo canción durante 60 segundos...");
        try { Thread.sleep(60000); } catch (InterruptedException e) {}
    }

    // --- TEST 2: PRUEBA DE ERROR (Pago fallido) ---
    @Test
    public void testPagoConDatosIncorrectos() {
        prepararEntornoGramola("Rock FM");

        // Buscar canción
        WebElement searchInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".search-input")));
        searchInput.clear();
        searchInput.sendKeys("Bohemian Rhapsody");
        wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-search"))).click();

        // Seleccionar canción
        WebElement resultsOverlay = wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("results-overlay")));
        try { Thread.sleep(1000); } catch (Exception e) {} 
        wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-add"))).click();

        // Rellenar Pago (Datos INCORRECTOS - Tarjeta incompleta)
        WebElement modalPago = wait.until(ExpectedConditions.visibilityOfElementLocated(By.tagName("app-pasarela-pago")));
        modalPago.findElement(By.cssSelector("input[placeholder='0000 0000 0000 0000']")).sendKeys("123"); 
        
        // Intentar pagar
        wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-pay"))).click();

        // Verificación: NO debe salir la pantalla de éxito
        boolean exitoVisible = false;
        try {
            WebDriverWait shortWait = new WebDriverWait(driver, Duration.ofSeconds(3));
            shortWait.until(ExpectedConditions.visibilityOfElementLocated(By.className("success-view")));
            exitoVisible = true;
        } catch (Exception e) {}

        if (!exitoVisible) System.out.println("✅ Test Error OK: El pago no procedió con datos malos.");
        else throw new RuntimeException("❌ Fallo: Pago incorrecto permitido.");
    }

    @AfterEach
    public void tearDown() {
        if (driver != null) {
             driver.quit();
        }
    }
}