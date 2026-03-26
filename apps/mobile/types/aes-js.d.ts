declare module "aes-js" {
  namespace ModeOfOperation {
    class cbc {
      constructor(key: Uint8Array, iv: Uint8Array);
      encrypt(plaintext: Uint8Array): Uint8Array;
      decrypt(ciphertext: Uint8Array): Uint8Array;
    }
  }

  namespace padding {
    namespace pkcs7 {
      function pad(data: Uint8Array): Uint8Array;
      function strip(data: Uint8Array): Uint8Array;
    }
  }
}
