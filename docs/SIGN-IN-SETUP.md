# Turning on "Sign in with Google, Microsoft and GitHub"

Empire uses **Firebase Authentication** (free) to check who someone is. After that, the shared game
account switches to that person, so their name and progress are the same in Empire and every game.

You do these steps once. Nothing here costs money.

## 1. Make a Firebase project
1. Go to https://console.firebase.google.com and sign in with a Google account.
2. **Create a project** → name it (for example `empire-silverninja`) → turn **Google Analytics off** → **Create project**.

## 2. Register Empire as a web app
1. On the project's home page, click the **`</>` (Web)** icon.
2. Nickname: `Empire`. Leave "Firebase Hosting" **unticked**. Click **Register app**.
3. You'll see a block of code with `firebaseConfig = { apiKey: …, authDomain: …, projectId: …, appId: … }`.
   Copy those four values into `src/lib/firebaseConfig.ts` (or send them to Claude).
   These values are public by design; they are not passwords.

## 3. Switch on the sign-in options
In the left menu: **Build → Authentication → Get started → Sign-in method**.

**Google**
- Click **Google** → **Enable** → pick your email as the support email → **Save**.

**GitHub**
1. Click **GitHub** → **Enable**. Copy the **callback URL** it shows (ends in `/__/auth/handler`). Leave this tab open.
2. On github.com: your picture → **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - Application name: `Empire`
   - Homepage URL: `https://silverninja71.github.io/Empire/`
   - Authorization callback URL: paste the callback URL from Firebase
3. **Register application**. Copy the **Client ID**, then **Generate a new client secret** and copy it.
4. Back in Firebase, paste the Client ID and Client secret → **Save**.

**Microsoft**
1. Click **Microsoft** → **Enable**. Copy the **callback URL** it shows. Leave this tab open.
2. Go to https://portal.azure.com (a free Microsoft account works) → search **App registrations** → **New registration**.
   - Name: `Empire`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: platform **Web**, paste the callback URL from Firebase
3. **Register**. Copy the **Application (client) ID**.
4. **Certificates & secrets → New client secret** → pick the longest expiry → **Add**, then copy the secret's **Value** (it's only shown once).
5. Back in Firebase, paste the Application ID and the secret → **Save**.
   Microsoft secrets expire: make a calendar reminder to make a new one before the date Azure shows.

## 4. Allow the website
**Authentication → Settings → Authorized domains → Add domain** → `silverninja71.github.io`.
(`localhost` is already allowed, for testing.)

## 5. Publish
Put the config values in `src/lib/firebaseConfig.ts`, commit and push. GitHub rebuilds Empire and the
three buttons in the sign-in window switch on.
