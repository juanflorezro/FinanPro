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
