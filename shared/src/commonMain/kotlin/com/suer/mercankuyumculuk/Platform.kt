package com.suer.mercankuyumculuk

interface Platform {
    val name: String
}

expect fun getPlatform(): Platform