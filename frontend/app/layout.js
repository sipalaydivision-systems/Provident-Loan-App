import './globals.css'

export const metadata = {
  title: 'Provident Loan Management System',
  description: 'Employee portal for provident loan management',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}