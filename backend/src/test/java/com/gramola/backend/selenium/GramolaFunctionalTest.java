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
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class GramolaFunctionalTest {

    private WebDriver driver;
    private WebDriverWait wait;
    
    // Carpeta segura para guardar tu sesión
    private static final String RUTA_PERFIL = System.getProperty("user.home") + "/selenium-chrome-profile";

    @BeforeAll
    public static void setupClass() {
        WebDriverManager.chromedriver().setup();
    }

    @BeforeEach
    public void setUp() {
        System.out.println("📂 Usando perfil persistente en: " + RUTA_PERFIL);
        
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--remote-allow-origins=*");
        options.addArguments("--autoplay-policy=no-user-gesture-required");
        
        // --- ARREGLO DE COLORES (FORZAR MODO OSCURO) ---
        // Esto hace que Chrome crea que tu sistema está en modo oscuro
        options.addArguments("--force-dark-mode"); 
        options.addArguments("--enable-features=WebUIDarkMode");
        
        // --- ARREGLO DE SESIÓN ---
        options.addArguments("user-data-dir=" + RUTA_PERFIL);
        options.addArguments("--profile-directory=Default"); 

        driver = new ChromeDriver(options);
        wait = new WebDriverWait(driver, Duration.ofSeconds(20));
        driver.manage().window().maximize();
    }

    private void prepararEntornoGramola(String busquedaPlaylist) {
        // 1. FORZAR LOGIN SIEMPRE
        driver.get("http://localhost:4200/login");
        
        JavascriptExecutor js = (JavascriptExecutor) driver;
        js.executeScript("window.localStorage.clear();");
        js.executeScript("window.sessionStorage.clear();");
        driver.navigate().refresh();

        System.out.println("🔒 Escribiendo credenciales en Gramola...");
        WebElement emailInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.name("email")));
        emailInput.clear();
        emailInput.sendKeys("bar@test.com"); 
        driver.findElement(By.name("password")).sendKeys("1234");
        driver.findElement(By.className("btn-login")).click();

        // 2. LÓGICA DE SEMÁFORO (CONNECT vs BUSCADOR)
        // Esperamos a llegar a la pantalla de configuración
        wait.until(ExpectedConditions.urlContains("config-audio"));

        System.out.println("🚦 Decidiendo si conectar Spotify o buscar...");

        // Esta lógica es mucho más robusta:
        // Buscamos si existe el botón de conectar. Si existe (size > 0), clicamos.
        // Si no existe, asumimos que ya estamos conectados.
        
        // Damos un pequeño respiro para que Angular pinte la pantalla
        try { Thread.sleep(1500); } catch (Exception e) {}

        List<WebElement> botonesConectar = driver.findElements(By.cssSelector(".connect-screen .btn-primary"));
        
        if (!botonesConectar.isEmpty() && botonesConectar.get(0).isDisplayed()) {
            System.out.println("🔌 Botón encontrado. Pulsando CONECTAR...");
            botonesConectar.get(0).click();

            // Espera de seguridad por si pide login de Spotify
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

        // 3. BUSQUEDA PLAYLIST (Ahora estamos seguros de estar conectados)
        System.out.println("📻 Buscando playlist real: " + busquedaPlaylist);
        
        // Esperamos explícitamente a que el input sea VISIBLE e INTERACTUABLE
        WebElement searchInput = wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector(".search-box input")));
        searchInput.clear();
        searchInput.sendKeys(busquedaPlaylist);
        
        driver.findElement(By.className("btn-search")).click();

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("results-list")));
        try { Thread.sleep(1000); } catch (Exception e) {} 

        wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-select"))).click();

        // 4. ENTRADA A GRAMOLA
        wait.until(ExpectedConditions.urlContains("/gramola"));
        gestionarAudio();
    }
    
    private void gestionarAudio() {
        try {
            // Intentamos buscar el botón de activar sonido durante 3 segundos
            WebDriverWait audioWait = new WebDriverWait(driver, Duration.ofSeconds(3));
            WebElement btn = audioWait.until(ExpectedConditions.elementToBeClickable(By.cssSelector(".btn-activate")));
            btn.click();
            System.out.println("🔊 Audio activado.");
        } catch (Exception e) {
            // Si no sale botón, hacemos click en el fondo por si acaso
            driver.findElement(By.tagName("body")).click();
        }
    }

    @Test
    public void testFlujoRealFernando_Costa() {
        prepararEntornoGramola("Fernando Costa");

        WebElement searchInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".search-input")));
        searchInput.clear();
        searchInput.sendKeys("Malamanera");
        
        wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-search"))).click();

        WebElement resultsOverlay = wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("results-overlay")));
        try { Thread.sleep(1000); } catch (Exception e) {} 
        
        wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-add"))).click();

        WebElement modalPago = wait.until(ExpectedConditions.visibilityOfElementLocated(By.tagName("app-pasarela-pago")));
        modalPago.findElement(By.cssSelector("input[placeholder='NOMBRE APELLIDOS']")).sendKeys("Tester Pro");
        modalPago.findElement(By.cssSelector("input[placeholder='0000 0000 0000 0000']")).sendKeys("1234567812345678");
        modalPago.findElement(By.cssSelector("input[placeholder='MM/AA']")).sendKeys("12/30");
        modalPago.findElement(By.cssSelector("input[placeholder='123']")).sendKeys("123");
        
        wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-pay"))).click();

        WebElement successView = wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("success-view")));
        assertTrue(successView.isDisplayed());
        
        System.out.println("✅ Test completado. 🎶 Reproduciendo canción durante 60 segundos...");
        try { Thread.sleep(60000); } catch (InterruptedException e) {}
    }

    @Test
    public void testPagoConDatosIncorrectos() {
        prepararEntornoGramola("Rock FM");

        WebElement searchInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".search-input")));
        searchInput.clear();
        searchInput.sendKeys("Bohemian Rhapsody");
        wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-search"))).click();

        WebElement resultsOverlay = wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("results-overlay")));
        try { Thread.sleep(1000); } catch (Exception e) {} 
        wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-add"))).click();

        WebElement modalPago = wait.until(ExpectedConditions.visibilityOfElementLocated(By.tagName("app-pasarela-pago")));
        modalPago.findElement(By.cssSelector("input[placeholder='0000 0000 0000 0000']")).sendKeys("123"); 
        wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-pay"))).click();

        boolean exitoVisible = false;
        try {
            WebDriverWait shortWait = new WebDriverWait(driver, Duration.ofSeconds(3));
            shortWait.until(ExpectedConditions.visibilityOfElementLocated(By.className("success-view")));
            exitoVisible = true;
        } catch (Exception e) {}

        if (!exitoVisible) System.out.println("✅ Test Error OK.");
        else throw new RuntimeException("❌ Fallo: Pago incorrecto permitido.");
    }

    @AfterEach
    public void tearDown() {
        if (driver != null) {
             driver.quit();
        }
    }
}