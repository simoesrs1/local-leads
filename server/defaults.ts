import type { EmailTemplate, TemplateVariable } from '../src/app/models/email.model.ts';
import type { StoredSettings } from './mailer.ts';

/** Starts in test mode so a fresh install can never email real businesses by accident. */
export const DEFAULT_SETTINGS: StoredSettings = {
  host: '',
  port: 465,
  secure: true,
  user: '',
  password: '',
  fromName: '',
  fromEmail: '',
  testMode: true,
  testEmail: '',
};

export const DEFAULT_VARIABLES: TemplateVariable[] = [
  { label: 'Nome Cliente', key: 'nome_cliente', source: 'name', value: '' },
  { label: 'Tipo Negócio', key: 'tipo_negocio', source: 'type', value: '' },
  { label: 'Email Cliente', key: 'email_cliente', source: 'email', value: '' },
  { label: 'Telefone', key: 'telefone', source: 'phone', value: '' },
  { label: 'Website', key: 'website', source: 'website', value: '' },
  { label: 'Morada', key: 'morada', source: 'address', value: '' },
  { label: 'Localidade', key: 'localidade', source: 'locality', value: '' },
  { label: 'Meu Nome', key: 'meu_nome', source: 'custom', value: '' },
  { label: 'Meu Website', key: 'meu_website', source: 'custom', value: '' },
];

export const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: 'website-intro',
    name: 'Apresentação – criação de website',
    subject: 'Presença online para {{nome_cliente}}',
    body: [
      'Olá equipa {{nome_cliente}},',
      '',
      'Chamo-me {{meu_nome}} e sou programador freelancer. Ao pesquisar negócios em {{localidade}}, reparei que ainda não têm website — hoje é muitas vezes o primeiro sítio onde os clientes procuram.',
      '',
      'Crio websites rápidos e modernos para pequenos negócios, a um preço justo. Pode ver alguns exemplos em {{meu_website}}.',
      '',
      'Teria 10 minutos esta semana para uma conversa sem compromisso?',
      '',
      'Cumprimentos,',
      '{{meu_nome}}',
      '',
      '---',
      'Se não pretender receber mais mensagens, basta responder com "remover".',
    ].join('\n'),
    updatedAt: new Date(0).toISOString(),
  },
];
