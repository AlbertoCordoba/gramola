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
    private JavaMailSender mailSender;

    public void sendWelcomeEmail(String to, String token) {
        String subject = "Bienvenido a Gramola Virtual - Confirma tu cuenta";
        String confirmationUrl = "http://localhost:8080/api/bares/verificar?token=" + token;

        // Mensaje en HTML
        String htmlMessage = "<h1>¡Bienvenido a Gramola Virtual!</h1>" +
                "<p>Gracias por registrar tu bar.</p>" +
                "<p>Para activar tu cuenta y acceder a los precios, por favor confirma tu correo haciendo clic en el botón de abajo:</p>" +
                "<a href=\"" + confirmationUrl + "\" style=\"background-color: #1ed760; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;\">Confirmar Cuenta</a>" +
                "<br><br>" +
                "<p>O copia y pega este enlace en tu navegador:</p>" +
                "<p>" + confirmationUrl + "</p>";

        sendHtmlEmail(to, subject, htmlMessage);
    }

    public void sendPasswordRecoveryEmail(String to, String token) {
        String subject = "Recuperación de Contraseña";
        String resetUrl = "http://localhost:4200/reset-password?token=" + token;

        String htmlMessage = "<h1>Recuperación de Contraseña</h1>" +
                "<p>Hemos recibido una solicitud para cambiar tu contraseña.</p>" +
                "<a href=\"" + resetUrl + "\" style=\"background-color: #1ed760; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;\">Restablecer Contraseña</a>" +
                "<br><br>" +
                "<p>Si no has sido tú, ignora este mensaje.</p>";

        sendHtmlEmail(to, subject, htmlMessage);
    }

    private void sendHtmlEmail(String to, String subject, String htmlContent) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            // true indica que es multipart (necesario para adjuntos o html complejo)
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setFrom("no-reply@gramolavirtual.com");
            helper.setText(htmlContent, true); // true indica que es HTML

            mailSender.send(message);
        } catch (MessagingException e) {
            System.err.println("Error enviando email: " + e.getMessage());
        }
    }
}