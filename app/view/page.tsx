import { redirect } from 'next/navigation'

// /view sem ID → redireciona para criar nova figurinha
export default function ViewIndexPage() {
  redirect('/criar')
}
