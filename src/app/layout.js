export const metadata = {
  title: 'Million Dollar Homepage',
  description: 'A replica of the Million Dollar Homepage',
}

export default function RootLayout({
  children,
}) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Bungee+Shade&family=Permanent+Marker&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}