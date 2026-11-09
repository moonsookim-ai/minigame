import java.util.Properties

plugins {
    id("com.android.application")
}

// 서명 정보: android/keystore.properties 가 있으면 release 서명에 사용한다 (저장소에는 올리지 않는다).
//   storeFile=/절대/경로/minigame-release.jks
//   storePassword=...
//   keyAlias=minigame
//   keyPassword=...
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

// 웹 파일(index.html, assets/, games/)을 앱 assets/www 로 복사한다.
val webRoot = rootProject.projectDir.parentFile
val generatedWww = layout.buildDirectory.dir("generated/webassets")
val copyWeb by tasks.registering(Sync::class) {
    into(generatedWww.map { it.dir("www") })
    from(webRoot) {
        include("index.html")
        include("assets/**")
        include("games/**")
        exclude("games/_template.html")
        exclude("assets/og.png")
    }
}

android {
    namespace = "com.moonsookim.minigame"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.moonsookim.minigame"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        if (keystoreProps.getProperty("storeFile") != null) {
            create("release") {
                storeFile = file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets["main"].assets.srcDir(generatedWww)
}

tasks.named("preBuild") { dependsOn(copyWeb) }

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}
