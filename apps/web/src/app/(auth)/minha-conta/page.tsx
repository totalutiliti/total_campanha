'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { AlertErro, AlertSucesso } from '../../../components/ui/alerts';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { PasswordInput } from '../../../components/ui/password-input';
import { useAuth } from '../../../lib/auth/context';
import { mensagemErro } from '../../../lib/erro';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  EDITOR_CAMPANHA: 'Editor de campanha',
  VISUALIZADOR: 'Visualizador',
};

export default function MinhaContaPage() {
  const { estado, api } = useAuth();

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (estado.tipo !== 'autenticado') return null;
  const { me } = estado;

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    if (novaSenha !== confirma) {
      setErro('As duas senhas novas precisam ser iguais.');
      return;
    }
    if (novaSenha.length < 8) {
      setErro('A senha nova precisa de pelo menos 8 caracteres.');
      return;
    }
    setSalvando(true);
    try {
      await api({ method: 'PATCH', path: '/auth/senha', body: { senhaAtual, novaSenha } });
      setSucesso('Senha alterada com sucesso.');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirma('');
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Minha conta</h1>
        <p className="text-sm text-muted-foreground mt-1">Seus dados de acesso.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Dados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">E-mail</p>
            <p className="font-medium">{me.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Empresa</p>
            <p className="font-medium">{me.tenantAtual?.razaoSocial}</p>
          </div>
          {me.role && (
            <div>
              <p className="text-muted-foreground">Seu papel</p>
              <p className="font-medium">{ROLE_LABELS[me.role] ?? me.role}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Trocar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={trocarSenha} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="senha-atual">Senha atual</Label>
              <PasswordInput
                id="senha-atual"
                autoComplete="current-password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nova-senha">Senha nova</Label>
              <PasswordInput
                id="nova-senha"
                autoComplete="new-password"
                placeholder="Pelo menos 8 caracteres"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirma">Repita a senha nova</Label>
              <PasswordInput
                id="confirma"
                autoComplete="new-password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                required
              />
            </div>
            {erro && <AlertErro>{erro}</AlertErro>}
            {sucesso && <AlertSucesso>{sucesso}</AlertSucesso>}
            <Button type="submit" disabled={salvando}>
              {salvando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar senha nova'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
