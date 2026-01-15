package com.gramola.backend.selenium;

import io.github.bonigarcia.wdm.WebDriverManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.*; 
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions; 
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;
import java.util.HashMap; 
import java.util.List;
import java.util.Map;     

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

public class GramolaFunctionalTest {

    private WebDriver driver;
    private WebDriverWait wait;
    
    private static final String RUTA_PERFIL = System.getProperty("user.home") + "/selenium-chrome-profile";

    @BeforeAll
    public static void setupClass() {
        WebDriverManager.chromedriver().setup();
    }

    @BeforeEach
    public void setUp() {
        System.out.println("📂 Usando perfil persistente en: " + RUTA_PERFIL);
        
        ChromeOptions options = new ChromeOptions();
        Map<String, Object> prefs = new HashMap<>();
        prefs.put("profile.password_manager_leak_detection", false);
        prefs.put("credentials_enable_service", false);
        prefs.put("profile.password_manager_enabled", false);
        options.setExperimentalOption("prefs", prefs);
        
        options.addArguments("--disable-save-password-bubble");
        options.addArguments("--remote-allow-origins=*");
        options.addArguments("--autoplay-policy=no-user-gesture-required");
        options.addArguments("--force-dark-mode"); 
        
        options.addArguments("user-data-dir=" + RUTA_PERFIL);
        options.addArguments("--profile-directory=Default"); 

        driver = new ChromeDriver(options);
        wait = new WebDriverWait(driver, Duration.ofSeconds(30));
        driver.manage().window().maximize();
    }

    // --- HELPER: Escribir tecleando (Simula humano) ---
    private void escribirEnElementoActivo(String texto) {
        Actions actions = new Actions(driver);
        for (char c : texto.toCharArray()) {
            actions.sendKeys(String.valueOf(c)).perform();
            try { Thread.sleep(100); } catch (Exception e) {} 
        }
    }

    // --- HELPER: Preparación Común ---
    private void prepararEntornoGramola(String busquedaPlaylist) {
        driver.get("http://localhost:4200/login");
        JavascriptExecutor js = (JavascriptExecutor) driver;
        js.executeScript("window.localStorage.clear();");
        js.executeScript("window.sessionStorage.clear();");
        driver.navigate().refresh();

        System.out.println("🔒 Login...");
        WebElement emailInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.name("email")));
        emailInput.clear();
        emailInput.sendKeys("aa@gail.com"); 
        driver.findElement(By.name("password")).sendKeys("11");
        driver.findElement(By.className("btn-login")).click();

        wait.until(ExpectedConditions.urlContains("config-audio"));
        try { Thread.sleep(1500); } catch (Exception e) {}

        List<WebElement> botonesConectar = driver.findElements(By.cssSelector(".connect-screen .btn-primary"));
        if (!botonesConectar.isEmpty() && botonesConectar.get(0).isDisplayed()) {
            botonesConectar.get(0).click();
            try {
                Thread.sleep(2000);
                if (!driver.getCurrentUrl().contains("config-audio")) {
                    new WebDriverWait(driver, Duration.ofSeconds(180))
                        .until(ExpectedConditions.urlContains("config-audio"));
                }
            } catch (Exception e) {}
        }

        System.out.println("📻 Buscando playlist: " + busquedaPlaylist);
        WebElement searchInput = wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector(".search-box input")));
        searchInput.click();
        searchInput.clear();
        searchInput.sendKeys(busquedaPlaylist);
        try { Thread.sleep(1000); } catch (Exception e) {} 
        
        driver.findElement(By.className("btn-search")).click();

        try {
            WebDriverWait shortWait = new WebDriverWait(driver, Duration.ofSeconds(3));
            shortWait.until(ExpectedConditions.visibilityOfElementLocated(By.className("results-list")));
        } catch (TimeoutException e) {
            driver.findElement(By.className("btn-search")).click(); 
            wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("results-list")));
        }
        
        try { Thread.sleep(1000); } catch (Exception e) {} 
        wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-select"))).click();

        try {
            WebElement btnConfirmar = wait.until(ExpectedConditions.elementToBeClickable(
                By.xpath("//button[contains(text(), 'Entrar') or contains(text(), 'Confirmar') or contains(@class, 'confirm')]")
            ));
            btnConfirmar.click();
        } catch (Exception e) {}

        wait.until(ExpectedConditions.urlContains("/gramola"));
        gestionarAudio();
    }
    
    private void gestionarAudio() {
        try {
            WebDriverWait audioWait = new WebDriverWait(driver, Duration.ofSeconds(2));
            WebElement btn = audioWait.until(ExpectedConditions.elementToBeClickable(By.cssSelector(".btn-activate")));
            btn.click();
        } catch (Exception e) {
            driver.findElement(By.tagName("body")).click();
        }
    }

    // ----------------------------------------------------------------------------------
    // TEST 1: CAMINO FELIZ (Happy Path)
    // ----------------------------------------------------------------------------------
    @Test
    public void testFlujoRealFernando_Costa() {
        prepararEntornoGramola("Fernando Costa");

        System.out.println("🎵 Buscando canción Malamanera...");
        WebElement searchInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".search-input")));
        searchInput.clear();
        searchInput.sendKeys("Malamanera");
        try { Thread.sleep(800); } catch (Exception e) {} 
        driver.findElement(By.className("btn-search")).click();

        try {
            WebDriverWait shortWait = new WebDriverWait(driver, Duration.ofSeconds(3));
            shortWait.until(ExpectedConditions.visibilityOfElementLocated(By.className("results-overlay")));
        } catch (TimeoutException e) {
            driver.findElement(By.className("btn-search")).click();
        }

        WebElement overlay = wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("results-overlay")));
        wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-add"))).click();

        // --- PAGO ---
        System.out.println("💳 Entrando en Pasarela de Pago...");
        
        WebElement modalPago = wait.until(ExpectedConditions.visibilityOfElementLocated(By.tagName("app-pasarela-pago")));
        try { Thread.sleep(2000); } catch (Exception e) {} 

        System.out.println("🎹 Escribiendo datos...");
        Actions actions = new Actions(driver);

        try {
            driver.findElement(By.xpath("//*[contains(text(), 'Estás pagando') or contains(text(), 'Información')]")).click();
        } catch (Exception e) {
            modalPago.click();
        }
        
        actions.sendKeys(Keys.TAB).perform();
        try { Thread.sleep(500); } catch (Exception e) {}

        // Tarjeta
        System.out.println("   -> Escribiendo Tarjeta...");
        escribirEnElementoActivo("4242424242424242");
        
        // Espera salto automático
        try { Thread.sleep(800); } catch (Exception e) {} 
        
        // Fecha
        System.out.println("   -> Escribiendo Fecha (1230)...");
        escribirEnElementoActivo("1230");

        try { Thread.sleep(800); } catch (Exception e) {}

        // CVC
        System.out.println("   -> Escribiendo CVC...");
        escribirEnElementoActivo("123");

        System.out.println("👇 Pulsando Pagar...");
        try {
            wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-pay"))).click();
        } catch (Exception e) {
            ((JavascriptExecutor) driver).executeScript("document.querySelector('.btn-pay').click();");
        }

        // --- VERIFICACIÓN DEFINITIVA: EL MODAL DEBE DESAPARECER ---
        System.out.println("⏳ Esperando que se cierre el modal de pago...");
        
        try {
            // Esperamos explícitamente a que el modal de pago YA NO ESTÉ VISIBLE
            boolean desaparecio = wait.until(ExpectedConditions.invisibilityOfElementLocated(By.tagName("app-pasarela-pago")));
            
            assertTrue(desaparecio, "El modal de pago no se cerró, el pago pudo haber fallado.");
            System.out.println("✅ El modal se cerró correctamente -> ¡PAGO EXITOSO!");
            
        } catch (TimeoutException e) {
            // Si el modal sigue ahí después de 30 segundos, es que falló
            fail("❌ ERROR: El modal de pago sigue visible tras pulsar Pagar.");
        }
        
        try { Thread.sleep(5000); } catch (InterruptedException e) {}
    }

    // ----------------------------------------------------------------------------------
    // TEST 2: CAMINO DE ERROR (Error Path)
    // ----------------------------------------------------------------------------------
    @Test
    public void testPagoConDatosIncorrectos() {
        prepararEntornoGramola("Rock FM");

        System.out.println("🧪 INICIANDO TEST: Pago con datos incorrectos...");

        // Buscar
        WebElement searchInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".search-input")));
        searchInput.clear();
        searchInput.sendKeys("Chojin"); 
        try { Thread.sleep(800); } catch (Exception e) {} 
        driver.findElement(By.className("btn-search")).click();

        try {
            WebDriverWait shortWait = new WebDriverWait(driver, Duration.ofSeconds(3));
            shortWait.until(ExpectedConditions.visibilityOfElementLocated(By.className("results-overlay")));
        } catch (TimeoutException e) {
            driver.findElement(By.className("btn-search")).click();
        }

        wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-add"))).click();

        // --- PAGO INCORRECTO ---
        System.out.println("💳 Entrando en Pasarela de Pago...");
        WebElement modalPago = wait.until(ExpectedConditions.visibilityOfElementLocated(By.tagName("app-pasarela-pago")));
        try { Thread.sleep(1500); } catch (Exception e) {} 

        Actions actions = new Actions(driver);

        try {
            driver.findElement(By.xpath("//*[contains(text(), 'Estás pagando') or contains(text(), 'Información')]")).click();
        } catch (Exception e) {
            modalPago.click();
        }
        
        actions.sendKeys(Keys.TAB).perform();
        try { Thread.sleep(500); } catch (Exception e) {}

        // Tarjeta MALA
        System.out.println("😈 Introduciendo tarjeta mala...");
        escribirEnElementoActivo("123"); 
        
        actions.sendKeys(Keys.TAB).perform(); // Salto manual
        try { Thread.sleep(500); } catch (Exception e) {}

        escribirEnElementoActivo("1230"); 
        actions.sendKeys(Keys.TAB).perform(); 
        escribirEnElementoActivo("123"); 

        System.out.println("👇 Pulsando Pagar...");
        try {
            WebElement btnPay = wait.until(ExpectedConditions.elementToBeClickable(By.className("btn-pay")));
            btnPay.click();
        } catch (Exception e) {
             try { ((JavascriptExecutor) driver).executeScript("document.querySelector('.btn-pay').click();"); } catch (Exception ex) {}
        }

        // --- VERIFICACIÓN: EL MODAL NO DEBE DESAPARECER ---
        System.out.println("🔍 Verificando que el modal SIGUE ABIERTO...");
        
        boolean modalSigueVisible = false;
        try {
            // Esperamos un poco a ver si desaparece (no debería)
            WebDriverWait shortWait = new WebDriverWait(driver, Duration.ofSeconds(4));
            shortWait.until(ExpectedConditions.invisibilityOfElementLocated(By.tagName("app-pasarela-pago")));
            // Si llega aquí, es que se cerró (MALO)
            modalSigueVisible = false;
        } catch (TimeoutException e) {
            // Si salta el timeout esperando que desaparezca, es que SIGUE VISIBLE (BUENO)
            modalSigueVisible = true;
        }

        if (modalSigueVisible) {
            System.out.println("✅ TEST OK: El modal sigue abierto tras tarjeta mala.");
        } else {
             fail("❌ FALLO DE SEGURIDAD: El modal se cerró (pago aceptado) con tarjeta falsa.");
        }
    }

    @AfterEach
    public void tearDown() {
        if (driver != null) {
             driver.quit();
        }
    }
}