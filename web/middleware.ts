import { NextRequest, NextResponse } from 'next/server'

const PROTECTED_PATHS = ['/dashboard', '/jobs', '/candidates', '/settings']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))

  if (!isProtected) {
    return NextResponse.next()
  }

  const search = request.nextUrl.searchParams
  const isSupabaseCallback = search.has('access_token') || search.has('refresh_token') || search.has('token') || search.has('code')

  const token = request.cookies.get('sb-access-token')?.value

  if (!token && !isSupabaseCallback) {
    const url = new URL('/login', request.url)
    url.searchParams.set('redirect_to', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/jobs/:path*', '/candidates/:path*', '/settings/:path*'],
}

