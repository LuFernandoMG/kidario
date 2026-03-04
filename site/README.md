# Kidario Site

Landing page independiente para Kidario, montada con Next.js (App Router).

## 1) Requisitos

- Node.js 18.18+ (recomendado Node.js 20+)

## 2) Configuracion

1. Crear archivo `.env.local` en esta carpeta (`site/`).
2. Copiar el contenido de `.env.example`.
3. Ajustar:

```bash
NEXT_PUBLIC_PLATFORM_URL=https://tu-plataforma.com
```

Esa URL se usa en todos los call to action (`Crear cuenta`, `Entrar`, `Ir a la plataforma`).

## 3) Ejecutar en local

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## 4) Build de produccion

```bash
npm run build
npm run start
```

## 5) Estructura

- `app/layout.tsx`: metadata + tipografias.
- `app/page.tsx`: contenido de la landing y CTAs.
- `app/globals.css`: estilo visual alineado a la paleta de Kidario.
