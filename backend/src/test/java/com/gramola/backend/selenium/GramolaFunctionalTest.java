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

import java.io.File;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class GramolaFunctionalTest {

    private WebDriver driver;
    private WebDriverWait wait;

    @BeforeAll
    public static void setupClass() {
        // ACTUALIZADO: Usamos la versión 143 que coincide con tu Brave
        WebDriverManager.chromedriver().browserVersion("143").setup();
    }

    @BeforeEach
    public void setUp() {
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--remote-allow-origins=*");
        
        // 1. PERMITIR AUDIO AUTOMÁTICO
        options.addArguments("--autoplay-policy=no-user-gesture-required");
        options.addArguments("--disable-features=AudioServiceOutOfProcess"); 

        // 2. RUTA DE BRAVE
        String bravePath = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
        File braveBinary = new File(bravePath);
        if (braveBinary.exists()) {
            options.setBinary(bravePath);
        }

        // 3. USAR TU PERFIL REAL (COPIA)
        // Asegúrate de que la carpeta PerfilTest existe en el escritorio y tiene tu sesión
        String userHome = System.getProperty("user.home");
        String copiaPerfilDir = userHome + "/Desktop/PerfilTest"; 
        
        options.addArguments("user-data-dir=" + copiaPerfilDir);
        options.addArguments("profile-directory=Default"); 

        driver = new ChromeDriver(options);
        wait = new WebDriverWait(driver, Duration.ofSeconds(20));
        driver.manage().window().maximize();
    }

    @Test
    public void testFlujoRealJC_Reyes() {
        // 1. LOGIN INTELIGENTE
        driver.get("http://localhost:4200/login");
        
        // Esperamos un momento para ver dónde estamos
        try { Thread.sleep(2000); } catch (InterruptedException e) {}

        // Si la URL sigue siendo /login, ES OBLIGATORIO LOGUEARSE
        if (driver.getCurrentUrl().contains("/login")) {
            System.out.println("🔒 Detectada pantalla de login. Iniciando sesión...");
            try {
                WebElement emailInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.name("email")));
                emailInput.clear();
                emailInput.sendKeys("bar@test.com"); 
                driver.findElement(By.name("password")).sendKeys("1234");
                driver.findElement(By.className("btn-login")).click();
            } catch (Exception e) {
                System.err.println("❌ Error intentando loguear: " + e.getMessage());
            }
        } else {
            System.out.println("ℹ️ Ya estabas logueado (cookie detectada).");
        }

        // Esperamos a entrar a la app (Dashboard o Config)
        wait.until(ExpectedConditions.urlContains("config-audio")); // O la ruta a la que redirija tu login
        
        // IMPORTANTE: Navegar a /gramola si no estamos allí
        if (!driver.getCurrentUrl().contains("/gramola")) {
             // 2. INYECTAR PLAYLIST JC REYES
            JavascriptExecutor js = (JavascriptExecutor) driver;
            js.executeScript(
                "localStorage.setItem('playlistFondo', JSON.stringify({" +
                    "name: 'JC Reyes Mix'," +
                    "uri: 'spotify:artist:0FwnPHExlRRxEZPLAi5tmG'," + 
                    "images: [{url: 'https://i.scdn.co/image/ab6761610000e5ebf7d9c6f2d2c5e5c5b5c5c5c5'}]," +
                    "tracks: {total: 20}" +
                "}));"
            );
            driver.get("http://localhost:4200/gramola");
        }

        // --- ACTIVAR AUDIO ---
        try {
            Thread.sleep(2000); 
            driver.findElement(By.tagName("body")).click(); 
            System.out.println("⏳ Conectando con Spotify...");
            Thread.sleep(3000); 
        } catch (InterruptedException e) {}

        // 4. BUSCAR "FARDOS"
        WebElement searchInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".search-input")));
        searchInput.clear();
        searchInput.sendKeys("Green lantern");
        driver.findElement(By.className("btn-search")).click();

        // 5. AÑADIR A LA COLA
        WebElement resultsOverlay = wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("results-overlay")));
        try { Thread.sleep(1500); } catch (Exception e) {} 
        
        resultsOverlay.findElement(By.className("btn-add")).click();

        // 6. PAGAR
        WebElement modalPago = wait.until(ExpectedConditions.visibilityOfElementLocated(By.tagName("app-pasarela-pago")));
        modalPago.findElement(By.cssSelector("input[placeholder='NOMBRE APELLIDOS']")).sendKeys("Usuario JC");
        modalPago.findElement(By.cssSelector("input[placeholder='0000 0000 0000 0000']")).sendKeys("1234567812345678");
        modalPago.findElement(By.cssSelector("input[placeholder='MM/AA']")).sendKeys("12/30");
        modalPago.findElement(By.cssSelector("input[placeholder='123']")).sendKeys("123");
        
        modalPago.findElement(By.className("btn-pay")).click();

        // 7. VERIFICAR ÉXITO
        WebElement successView = wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("success-view")));
        assertTrue(successView.isDisplayed());
        System.out.println("✅ ¡Pedido completado! Escucha...");

        try { Thread.sleep(20000); } catch (InterruptedException e) {}
    }

    @Test
    public void testPagoConDatosIncorrectos() {
        driver.get("http://localhost:4200/login");
        // Lógica de login simplificada para el test de error
        if (driver.getCurrentUrl().contains("/login")) {
            try {
                driver.findElement(By.name("email")).sendKeys("bar@test.com"); 
                driver.findElement(By.name("password")).sendKeys("1234");
                driver.findElement(By.className("btn-login")).click();
            } catch (Exception e) {}
        }

        // Inyectamos cualquier playlist
        JavascriptExecutor js = (JavascriptExecutor) driver;
        js.executeScript("localStorage.setItem('playlistFondo', JSON.stringify({name:'Test', uri:'mock', images:[{url:''}], tracks:{total:10}}));");

        driver.get("http://localhost:4200/gramola");
        
        WebElement searchInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".search-input")));
        searchInput.sendKeys("Error");
        driver.findElement(By.className("btn-search")).click();

        WebElement resultsOverlay = wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("results-overlay")));
        resultsOverlay.findElement(By.className("btn-add")).click();

        WebElement modalPago = wait.until(ExpectedConditions.visibilityOfElementLocated(By.tagName("app-pasarela-pago")));
        modalPago.findElement(By.cssSelector("input[placeholder='NOMBRE APELLIDOS']")).sendKeys("Usuario Fail");
        modalPago.findElement(By.cssSelector("input[placeholder='0000 0000 0000 0000']")).sendKeys("123"); 
        modalPago.findElement(By.cssSelector("input[placeholder='MM/AA']")).sendKeys("12/30");
        modalPago.findElement(By.cssSelector("input[placeholder='123']")).sendKeys("123");

        modalPago.findElement(By.className("btn-pay")).click();

        boolean exitoVisible = false;
        try {
            WebDriverWait shortWait = new WebDriverWait(driver, Duration.ofSeconds(2));
            shortWait.until(ExpectedConditions.visibilityOfElementLocated(By.className("success-view")));
            exitoVisible = true;
        } catch (Exception e) {
            exitoVisible = false;
        }

        if (!exitoVisible) {
            System.out.println("✅ Test ERROR superado.");
        } else {
            throw new RuntimeException("❌ Fallo: Se permitió pagar con tarjeta falsa.");
        }
    }

    @AfterEach
    public void tearDown() {
        if (driver != null) {
            driver.quit();
        }
    }
}