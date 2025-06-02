# Backend Rifa - MercadoPago + Firebase

## Como rodar

1. Instale as dependências:
   ```
   npm install
   ```

2. **Adicione o arquivo de credenciais do Firebase**
   - Baixe o arquivo `serviceAccountKey.json` do console do Firebase.
   - Coloque o arquivo na pasta `backend/` (NÃO suba esse arquivo para o GitHub).

3. **Configure o Access Token do MercadoPago**
   - No arquivo `server.js`, troque `'SEU_ACCESS_TOKEN_AQUI'` pelo seu Access Token do MercadoPago.
   - Ou, se preferir, use uma variável de ambiente.

4. Para rodar localmente:
   ```
   node server.js
   ```

## Deploy no Render/Railway

- Após subir o código, adicione o arquivo `serviceAccountKey.json` como **Secret File** no painel do Render/Railway.
- Nunca exponha esse arquivo em repositórios públicos.
