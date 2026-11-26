# Springer Elementary Marquee Maker

A zero-backend, 100% browser-based tool for creating and previewing exact **256 × 96 pixel `.jpg`** slides for the Springer Elementary LED marquee.

## Features

- **Exact Output (`256 × 96 px` JPG):** Always exports an opaque JPEG file at the exact hardware dimensions.
- **Realistic LED Matrix Preview:** Shows how graphics actually look across physical LED dots alongside a **1:1 Actual Size** preview, making it immediately obvious why tiny text and QR codes do not work on the sign.
- **Readability Guardrails:** Automatically warns on small text (`< 14px`), excessive word count (`> 10` words), low color contrast, and bright/glare-heavy backgrounds.
- **Starter Presets:** Includes birthday templates, Springer green & gold themes, a high-visibility traffic template, and a **"Test Existing Image"** mode.
- **Background & PNG Overlay Uploads:** Upload a photo/flyer to resize/crop/tint, plus layer transparent PNG logos or built-in SVG stickers with drag-and-drop or slider/arrow positioning.
- **Private & Safe:** Everything runs locally in the user's browser memory (`<canvas>`). Nothing is uploaded to any server.

## Publish Free on GitHub Pages (3 Steps)

1. Create a new public repository on GitHub (e.g. `springer-marquee-maker`) and push all files in this folder (`index.html`, `.nojekyll`, `css/`, `js/`, `README.md`).
2. In the GitHub repository, open **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**, choose `main` and `/ (root)`, then click **Save**. Your live link (`https://<username>.github.io/<repo>/`) will be ready in ~1 minute.

## Optional: Embed on the PTA Website

Once hosted on GitHub Pages, a PTA site admin can embed it without touching any server code:

```html
<iframe
  src="https://<username>.github.io/<repo>/"
  title="Springer Elementary Marquee Maker"
  width="100%"
  height="920"
  style="border: 1px solid #d6ded9; border-radius: 12px;"
  sandbox="allow-scripts allow-same-origin allow-downloads"
></iframe>
```

> **Note:** Some website builders restrict `<iframe>` downloads. If a user's browser blocks downloading inside the embed, share the direct GitHub Pages URL instead.
