// Texto y tono de cada estado del sistema.
export const TENANT_STATUS = {
  prospecto: ['Prospecto', 'neutral'],
  pendiente_pago: ['Pendiente de pago', 'warn'],
  habilitado: ['Habilitado', 'info'],
  activo: ['Activo', 'ok'],
  suspendido: ['Suspendido', 'bad'],
  cancelado: ['Cancelado', 'neutral'],
};

export const SUB_STATUS = {
  prueba: ['En prueba', 'info'],
  activa: ['Al día', 'ok'],
  en_gracia: ['En gracia', 'warn'],
  vencida: ['Vencida', 'bad'],
  cancelada: ['Cancelada', 'neutral'],
};

export const ORG_STATUS = {
  activa: ['Activa', 'ok'],
  solo_lectura: ['Solo lectura', 'warn'],
  suspendida: ['Suspendida', 'bad'],
  archivada: ['Archivada', 'neutral'],
};

export const LOAN_STATUS = {
  solicitud: ['Solicitud', 'neutral'],
  aprobado: ['Aprobado', 'info'],
  desembolsado: ['Desembolsado', 'info'],
  al_dia: ['Al día', 'ok'],
  en_mora: ['En mora', 'bad'],
  reestructurado: ['Reestructurado', 'warn'],
  pagado: ['Pagado', 'neutral'],
  castigado: ['Castigado', 'bad'],
  anulado: ['Anulado', 'neutral'],
};

export const INSTALLMENT_STATUS = {
  pendiente: ['Pendiente', 'neutral'],
  parcial: ['Parcial', 'info'],
  pagada: ['Pagada', 'ok'],
  vencida: ['Vencida', 'bad'],
  condonada: ['Condonada', 'neutral'],
  anulada: ['Anulada', 'neutral'],
};

export const ADMIN_ROLES = { superadmin: 'Superadministrador', finanzas: 'Finanzas', soporte: 'Soporte' };
export const MEMBER_ROLES = { owner: 'Dueño', admin: 'Administrador', analista: 'Analista', cobrador: 'Cobrador', auditor: 'Auditor' };
export const CYCLES = { mensual: 'Mensual', trimestral: 'Trimestral', anual: 'Anual' };
export const PAY_METHODS = { transferencia: 'Transferencia', pasarela: 'Pasarela de pago', efectivo: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata', otro: 'Otro' };
export const MODALITIES = { consumo: 'Consumo y ordinario', bajo_monto: 'Bajo monto', microcredito: 'Microcrédito', comercial: 'Comercial', otro: 'Otra' };
export const COUNTRIES = { CO: 'Colombia', MX: 'México', PE: 'Perú', EC: 'Ecuador', CL: 'Chile', ES: 'España', US: 'Estados Unidos' };

export const ACTIONS = {
  'tenant.create': 'Registró un cliente',
  'tenant.update': 'Editó un cliente',
  'tenant.enable': 'Habilitó un cliente',
  'tenant.payment': 'Registró un pago',
  'tenant.plan_change': 'Cambió el plan',
  'tenant.suspend': 'Suspendió un cliente',
  'tenant.reactivate': 'Reactivó un cliente',
  'tenant.revoke_email': 'Revocó un correo habilitado',
  'plan.create': 'Creó un plan',
  'plan.update': 'Editó un plan',
  'org.status': 'Cambió el estado de una organización',
  'org.compliance': 'Cambió la acogida a la ley de tasa',
  'rate_cap.create': 'Registró una tasa máxima',
  'rate_cap.update': 'Editó una tasa máxima',
  'support.grant': 'Abrió acceso de soporte',
  'support.revoke': 'Cerró acceso de soporte',
  'support.view_loan': 'Consultó un préstamo (soporte)',
  'support.refresh_loan': 'Recalculó un préstamo (soporte)',
  'admin.update': 'Editó un administrador',
};

export const AMORTIZATION = {
  frances: ['Cuota fija', 'Todas las cuotas iguales. Al inicio se paga más interés y al final más capital.'],
  aleman: ['Capital fijo', 'El abono a capital es igual en cada cuota, así que la cuota baja con el tiempo.'],
  interes_simple: ['Interés simple', 'El interés se calcula siempre sobre el capital inicial. Cuotas iguales.'],
  solo_interes: ['Solo interés', 'Paga interés en cada cuota y todo el capital en la última.'],
  abonos_libres: ['Abonos libres', 'Paga el interés de cada período y abona a capital cuando pueda. Sin número de cuotas.'],
};
export const RATE_BASIS = { mensual: 'mensual', anual: 'anual', quincenal: 'quincenal', semanal: 'semanal', diaria: 'diaria' };
export const FREQUENCY = { mensual: 'Mensual', quincenal: 'Quincenal', semanal: 'Semanal', diaria: 'Diaria' };
export const PAYMENT_METHODS_APP = { efectivo: 'Efectivo', transferencia: 'Transferencia', nequi: 'Nequi', daviplata: 'Daviplata', pasarela: 'Pasarela de pago', otro: 'Otro' };
export const RATE_CHECK = {
  no_aplica: ['Tasa libre', 'neutral'],
  dentro: ['Dentro del tope legal', 'ok'],
  excede_confirmado: ['Supera el tope, confirmado', 'warn'],
  sin_tope_cargado: ['Sin tope cargado', 'warn'],
};
