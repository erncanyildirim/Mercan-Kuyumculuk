import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.util.Properties

plugins {
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.composeCompiler)
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_11
    }
}
dependencies {
    implementation(project(":shared"))

    implementation(libs.androidx.activity.compose)

    implementation(libs.compose.uiToolingPreview)
    debugImplementation(libs.compose.uiTooling)
}

// Upload key for Google Play. Kept outside the repo; path can be overridden with MERCAN_UPLOAD_KEYSTORE_PROPERTIES.
val uploadKeystoreProps = Properties().apply {
    val path = System.getenv("MERCAN_UPLOAD_KEYSTORE_PROPERTIES")
        ?: "${System.getProperty("user.home")}/.mercan-signing/upload-keystore.properties"
    val file = File(path)
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "com.suer.mercankuyumculuk"
    compileSdk = libs.versions.android.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "com.suer.mercankuyumculuk"
        minSdk = libs.versions.android.minSdk.get().toInt()
        targetSdk = libs.versions.android.targetSdk.get().toInt()
        versionCode = 1
        versionName = "1.0"
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
    signingConfigs {
        if (uploadKeystoreProps.isNotEmpty()) {
            create("upload") {
                storeFile = File(uploadKeystoreProps.getProperty("storeFile"))
                storePassword = uploadKeystoreProps.getProperty("storePassword")
                keyAlias = uploadKeystoreProps.getProperty("keyAlias")
                keyPassword = uploadKeystoreProps.getProperty("keyPassword")
            }
        }
    }
    buildTypes {
        release {
            signingConfigs.findByName("upload")?.let { signingConfig = it }
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
    }
}