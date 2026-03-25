import { LoginForm } from "@/components/LoginForm"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Entrar | SaaS",
  description: "Acesse sua conta para continuar",
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Bem-vindo</h1>
          <p className="mt-2 text-slate-600">Acesse sua conta para continuar</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
