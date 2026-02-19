package com.gramola.backend.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender; // El "cartero" que nos da Spring Boot.

    // MÉTODO: Envía el correo de bienvenida con un enlace único para confirmar la cuenta del bar.
    public void sendWelcomeEmail(String to, String token) {
        String subject = "Bienvenido a la fiesta - Gramola Virtual";
        // Construimos la URL única con el token para que el usuario haga clic
        String confirmationUrl = "http://localhost:8080/api/bares/verificar?token=" + token;

        String htmlContent = createHtmlTemplate(
            "¡Bienvenido a bordo!",
            "Gracias por unirte a Gramola Virtual.<br>Estás a un solo clic de revolucionar la música de tu local.",
            "Confirmar mi Cuenta",
            confirmationUrl
        );

        sendHtmlEmail(to, subject, htmlContent);
    }

    // MÉTODO: Envía un enlace al correo del bar para que pueda restablecer su contraseña de forma segura.
    public void sendPasswordRecoveryEmail(String to, String token) {
        String subject = "Recupera tu acceso 🔐";
        // Esta URL apunta al Frontend (Angular) para mostrar el formulario de nueva contraseña
        String resetUrl = "http://localhost:4200/reset-password?token=" + token;

        String htmlContent = createHtmlTemplate(
            "Restablecer Contraseña",
            "Hemos recibido una solicitud para cambiar tu contraseña.<br>Si no has sido tú, puedes ignorar este mensaje tranquilamente.",
            "Crear Nueva Contraseña",
            resetUrl
        );

        sendHtmlEmail(to, subject, htmlContent);
    }

    // MÉTODO: Función interna que configura el mensaje (MimeMessage), define el destinatario, el asunto y el contenido HTML.
    private void sendHtmlEmail(String to, String subject, String htmlContent) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            // true indica multipart (necesario para html)
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setFrom("Gramola Virtual <no-reply@gramolavirtual.com>");
            helper.setText(htmlContent, true); // true indica que es HTML, para que lo renderice bien

            mailSender.send(message);
        } catch (MessagingException e) {
            // Logueamos el error pero no rompemos la ejecución principal
            System.err.println("Error enviando email: " + e.getMessage());
        }
    }

    // MÉTODO: Genera la estructura visual (plantilla) en HTML/CSS para que los correos tengan un diseño profesional tipo Spotify.
    private String createHtmlTemplate(String title, String bodyText, String btnText, String btnUrl) {
        return """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { margin: 0; padding: 0; background-color: #121212; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                    .container { 
                        max-width: 600px; 
                        margin: 40px auto; 
                        background-color: #1e1e1e; 
                        border-radius: 16px; 
                        overflow: hidden; 
                        box-shadow: 0 10px 40px rgba(0,0,0,0.5); 
                        border: 1px solid #333;
                    }
                    .header { 
                        background-color: #000000; 
                        padding: 30px; 
                        text-align: center; 
                        border-bottom: 2px solid #1ed760; 
                    }
                    .logo { 
                        color: #ffffff; 
                        font-size: 28px; 
                        font-weight: 800; 
                        text-decoration: none; 
                        letter-spacing: -1px;
                    }
                    .logo span { color: #1ed760; }
                    
                    .content { padding: 50px 30px; color: #ffffff; text-align: center; }
                    
                    h1 { 
                        font-size: 32px; 
                        margin: 0 0 20px; 
                        color: #ffffff; 
                        font-weight: 700; 
                    }
                    
                    p { 
                        font-size: 16px; 
                        line-height: 1.6; 
                        color: #b3b3b3; 
                        margin-bottom: 40px; 
                    }
                    
                    .btn { 
                        display: inline-block; 
                        padding: 16px 40px; 
                        background-color: #1ed760; 
                        color: #000000; 
                        text-decoration: none; 
                        border-radius: 50px; 
                        font-weight: 800; 
                        font-size: 16px; 
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        transition: 0.3s;
                    }
                    .btn:hover { background-color: #1fdf64; }
                    
                    .footer { 
                        padding: 30px; 
                        text-align: center; 
                        font-size: 12px; 
                        color: #555555; 
                        background-color: #181818; 
                        border-top: 1px solid #252525;
                    }
                    .link-alt { color: #1ed760; text-decoration: none; word-break: break-all; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🎵 Gramola<span>Virtual</span></div>
                    </div>
                    <div class="content">
                        <h1>%s</h1>
                        <p>%s</p>
                        <a href="%s" class="btn" target="_blank">%s</a>
                    </div>
                    <div class="footer">
                        <p>© 2026 Gramola Virtual. Todos los derechos reservados.</p>
                        <p>Si el botón no funciona, copia este enlace en tu navegador:<br>
                        <a href="%s" class="link-alt">%s</a></p>
                    </div>
                </div>
            </body>
            </html>
            """.formatted(title, bodyText, btnUrl, btnText, btnUrl, btnUrl); // .formatted() rellena los %s dinámicamente
    }
}