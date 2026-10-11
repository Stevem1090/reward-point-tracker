// Run after `npx cap add android`: copies Family Hub's native code into the
// generated project and wires up permissions, services, signing and icons.
import fs from 'node:fs';
import path from 'node:path';

const PKG = 'app/lovable/p6d6906c6162c45aeb91047ebf987bb28';
const app = 'android/app';
const main = `${app}/src/main`;

const copyDir = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    const s = path.join(from, f), d = path.join(to, f);
    fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
};
copyDir(`native/android/java/${PKG}`, `${main}/java/${PKG}`);
copyDir('native/android/res', `${main}/res`);

// Launcher icon from the web app icon.
fs.rmSync(`${main}/res/mipmap-anydpi-v26`, { recursive: true, force: true });
for (const dir of fs.readdirSync(`${main}/res`).filter((d) => d.startsWith('mipmap-'))) {
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
    fs.copyFileSync('public/icons/icon-512.png', `${main}/res/${dir}/${name}`);
  }
}

// Manifest
const manifestPath = `${main}/AndroidManifest.xml`;
let m = fs.readFileSync(manifestPath, 'utf8');
const perms = [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
  'android.permission.USE_EXACT_ALARM',
  'android.permission.WAKE_LOCK',
].map((p) => `    <uses-permission android:name="${p}" />`).join('\n')
  + '\n    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" android:maxSdkVersion="32" />\n';
const components = `
        <service android:name=".MessagingService" android:exported="false">
            <intent-filter><action android:name="com.google.firebase.MESSAGING_EVENT" /></intent-filter>
        </service>
        <receiver android:name=".ReminderAlarmReceiver" android:exported="false" />
        <receiver android:name=".MarkDoneReceiver" android:exported="false" />
        <receiver android:name=".BootReceiver" android:exported="false">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>
        <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="task_reminders" />
`;
if (!m.includes('.MessagingService')) {
  m = m.replace('</application>', `${components}    </application>`);
  m = m.replace(/(\s*)<application/, `\n${perms}$1<application`);
  m = m.replace('android:launchMode="singleTask"', 'android:launchMode="singleTask"'); // keep single instance
}
fs.writeFileSync(manifestPath, m);

// Gradle: Firebase Messaging + release signing + version from CI.
const gradlePath = `${app}/build.gradle`;
let g = fs.readFileSync(gradlePath, 'utf8');
if (!g.includes('firebase-messaging')) {
  g = g.replace(/dependencies \{/, `dependencies {\n    implementation platform('com.google.firebase:firebase-bom:33.7.0')\n    implementation 'com.google.firebase:firebase-messaging'`);
  g = g.replace(/versionCode \d+/, `versionCode (System.getenv("VERSION_CODE") ?: "1").toInteger()`);
  g = g.replace(/versionName "[^"]*"/, `versionName (System.getenv("VERSION_NAME") ?: "1.0")`);
  g = g.replace(/buildTypes \{/, `signingConfigs {
        release {
            if (System.getenv("KEYSTORE_PATH")) {
                storeFile file(System.getenv("KEYSTORE_PATH"))
                storePassword System.getenv("KEYSTORE_PASSWORD")
                keyAlias System.getenv("KEY_ALIAS")
                keyPassword System.getenv("KEYSTORE_PASSWORD")
            }
        }
    }
    buildTypes {`);
  g = g.replace(/release \{\s*minifyEnabled false/, 'release {\n            signingConfig signingConfigs.release\n            minifyEnabled false');
}
fs.writeFileSync(gradlePath, g);

if (!fs.existsSync(`${app}/google-services.json`)) {
  console.error('Missing android/app/google-services.json – notifications will not work.');
  process.exit(1);
}
console.log('Android project patched for Family Hub.');
