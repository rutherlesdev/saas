import { SignUpForm } from "@/components/SignUpForm"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Criar Conta | SaaS",
  description: "Crie sua conta para começar a usar a plataforma",
}

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Comece Agora</h1>
          <p className="mt-2 text-slate-600">Crie sua conta em segundos</p>
        </div>
        <SignUpForm />
      </div>
    </div>
  )
}
