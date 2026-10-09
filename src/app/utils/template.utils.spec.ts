import { TemplateVariable } from '../models/email.model';
import { Lead } from '../models/lead.model';
import { placeholdersIn, renderEmail, renderTemplate, slugifyKey } from './template.utils';

const lead: Lead = {
  id: 'osm:node/1',
  source: 'osm',
  name: 'Padaria Central',
  type: 'Bakery',
  phones: ['244 123 456', '912 345 678'],
  hasMobile: true,
  email: null,
  website: null,
  address: 'Rua Direita 5, Leiria',
  latitude: null,
  longitude: null,
  mapsUrl: '',
};

const variables: TemplateVariable[] = [
  { label: 'Nome Cliente', key: 'nome_cliente', source: 'name', value: '' },
  { label: 'Telefone', key: 'telefone', source: 'phone', value: '' },
  { label: 'Email Cliente', key: 'email_cliente', source: 'email', value: '' },
  { label: 'Localidade', key: 'localidade', source: 'locality', value: '' },
  { label: 'Meu Nome', key: 'meu_nome', source: 'custom', value: 'Rúben' },
];

describe('template utils', () => {
  it('turns labels into placeholder keys', () => {
    expect(slugifyKey('Nome Cliente')).toBe('nome_cliente');
    expect(slugifyKey('  Tipo de Negócio! ')).toBe('tipo_de_negocio');
    expect(slugifyKey('2º contacto')).toBe('v_2_contacto');
  });

  it('lists placeholders, tolerating spaces inside the braces', () => {
    expect(placeholdersIn('Olá {{nome_cliente}}, {{ meu_nome }} e {{nome_cliente}}')).toEqual([
      'nome_cliente',
      'meu_nome',
    ]);
  });

  it('replaces known keys and reports unknown and empty ones', () => {
    const result = renderTemplate('{{a}} {{b}} {{c}}', { a: 'x', b: '' });
    expect(result.text).toBe('x  {{c}}');
    expect(result.unknown).toEqual(['c']);
    expect(result.empty).toEqual(['b']);
  });

  it('renders a full email from lead fields, custom values and context', () => {
    const email = renderEmail(
      {
        subject: 'Website para {{nome_cliente}}',
        body: 'Olá {{nome_cliente}} ({{telefone}}) em {{localidade}}.\n{{meu_nome}} {{email_cliente}}',
      },
      variables,
      lead,
      { locality: 'Leiria, Portugal' },
    );
    expect(email.subject).toBe('Website para Padaria Central');
    expect(email.body).toBe('Olá Padaria Central (244 123 456) em Leiria.\nRúben ');
    expect(email.empty).toEqual(['email_cliente']);
    expect(email.unknown).toEqual([]);
  });
});
