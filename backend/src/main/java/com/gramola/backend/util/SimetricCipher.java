package com.gramola.backend.util;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

public class SimetricCipher {

    // IMPORTANTE: Esta clave debe tener 16 caracteres exactos para AES-128.
    private static final String SECRET_KEY = "BarGramolaSuperS"; 

    public static String encrypt(String strToEncrypt) {
        try {
            if (strToEncrypt == null) return null;
            Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(SECRET_KEY.getBytes(), "AES"));
            return Base64.getEncoder().encodeToString(cipher.doFinal(strToEncrypt.getBytes()));
        } catch (Exception e) {
            System.err.println("Error cifrando: " + e.getMessage());
            return null;
        }
    }

    public static String decrypt(String strToDecrypt) {
        try {
            if (strToDecrypt == null) return null;
            Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(SECRET_KEY.getBytes(), "AES"));
            return new String(cipher.doFinal(Base64.getDecoder().decode(strToDecrypt)));
        } catch (Exception e) {
            System.err.println("Error descifrando: " + e.getMessage());
            return null;
        }
    }
}