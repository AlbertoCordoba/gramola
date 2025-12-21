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
        // Forzamos versión compatible con Brave
        WebDriverManager.chromedriver().browserVersion("142").setup();
    }

    @BeforeEach
    public void setUp() {
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--remote-allow-origins=*");
        
        // RUTA DE BRAVE (Mac OS)
        String bravePath = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
        File braveBinary = new File(bravePath);
        if (braveBinary.exists()) {
            options.setBinary(bravePath);
        }

        driver = new ChromeDriver(options);
        wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        driver.manage().window().maximize();
    }

    @Test
    public void testFlujoCompletoExitoso() {
        // 1. LOGIN
        driver.get("http://localhost:4200/login");
        WebElement emailInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.name("email")));
        emailInput.sendKeys("bar@test.com"); // USUARIO EXISTENTE
        driver.findElement(By.name("password")).sendKeys("1234");
        driver.findElement(By.className("btn-login")).click();

        wait.until(ExpectedConditions.urlContains("/config-audio"));
        
        // 2. INYECTAR PLAYLIST (Para saltar configuración)
        JavascriptExecutor js = (JavascriptExecutor) driver;
        js.executeScript("localStorage.setItem('playlistFondo', JSON.stringify({name:'Test', uri:'mock', images:[{url:''}], tracks:{total:10}}));");

        // 3. IR A GRAMOLA Y BUSCAR
        driver.get("http://localhost:4200/gramola");
        WebElement searchInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".search-input")));
        searchInput.sendKeys("Bohemian");
        driver.findElement(By.className("btn-search")).click();

        // 4. AÑADIR
        WebElement resultsOverlay = wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("results-overlay")));
        resultsOverlay.findElement(By.className("btn-add")).click();

        // 5. PAGAR (Datos Correctos)
        WebElement modalPago = wait.until(ExpectedConditions.visibilityOfElementLocated(By.tagName("app-pasarela-pago")));
        modalPago.findElement(By.cssSelector("input[placeholder='NOMBRE APELLIDOS']")).sendKeys("Tester Selenium");
        modalPago.findElement(By.cssSelector("input[placeholder='0000 0000 0000 0000']")).sendKeys("1234567812345678");
        modalPago.findElement(By.cssSelector("input[placeholder='MM/AA']")).sendKeys("12/30");
        modalPago.findElement(By.cssSelector("input[placeholder='123']")).sendKeys("123");
        
        modalPago.findElement(By.className("btn-pay")).click();

        // 6. VERIFICAR ÉXITO
        WebElement successView = wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("success-view")));
        assertTrue(successView.isDisplayed());
        System.out.println("✅ Test ÉXITO superado.");
    }

    @Test
    public void testPagoConDatosIncorrectos() {
        // 1. LOGIN
        driver.get("http://localhost:4200/login");
        WebElement emailInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.name("email")));
        emailInput.sendKeys("bar@test.com"); 
        driver.findElement(By.name("password")).sendKeys("1234");
        driver.findElement(By.className("btn-login")).click();

        wait.until(ExpectedConditions.urlContains("/config-audio"));
        JavascriptExecutor js = (JavascriptExecutor) driver;
        js.executeScript("localStorage.setItem('playlistFondo', JSON.stringify({name:'Test', uri:'mock', images:[{url:''}], tracks:{total:10}}));");

        // 2. GRAMOLA
        driver.get("http://localhost:4200/gramola");
        WebElement searchInput = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".search-input")));
        searchInput.sendKeys("Error Song");
        driver.findElement(By.className("btn-search")).click();

        // 3. AÑADIR
        WebElement resultsOverlay = wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("results-overlay")));
        resultsOverlay.findElement(By.className("btn-add")).click();

        // 4. PAGAR CON DATOS INCORRECTOS (Tarjeta corta "123")
        WebElement modalPago = wait.until(ExpectedConditions.visibilityOfElementLocated(By.tagName("app-pasarela-pago")));
        modalPago.findElement(By.cssSelector("input[placeholder='NOMBRE APELLIDOS']")).sendKeys("Usuario Torpe");
        modalPago.findElement(By.cssSelector("input[placeholder='0000 0000 0000 0000']")).sendKeys("123"); // ERROR
        modalPago.findElement(By.cssSelector("input[placeholder='MM/AA']")).sendKeys("12/30");
        modalPago.findElement(By.cssSelector("input[placeholder='123']")).sendKeys("123");

        modalPago.findElement(By.className("btn-pay")).click();

        // 5. VERIFICAR QUE NO HAY ÉXITO (Debe fallar o no avanzar)
        boolean exitoVisible = false;
        try {
            // Esperamos solo 2 segundos. Si aparece éxito, mal. Si salta timeout, bien.
            WebDriverWait shortWait = new WebDriverWait(driver, Duration.ofSeconds(2));
            shortWait.until(ExpectedConditions.visibilityOfElementLocated(By.className("success-view")));
            exitoVisible = true;
        } catch (Exception e) {
            exitoVisible = false;
        }

        if (!exitoVisible) {
            System.out.println("✅ Test ERROR superado: El sistema bloqueó el pago incorrecto.");
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