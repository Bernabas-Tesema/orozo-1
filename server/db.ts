import {
  User,
  SupportedLanguage,
  InterpreterProfile,
  InterpretationRequest,
  Assignment,
  InterpretationSession,
  SessionParticipant,
  CompletionReport,
  PlatformNotification,
  AuditLog,
  PlatformSettings,
  ServiceCategory
} from './types';

// Pre-seeded supported Ethiopian languages as per Ethiopian demographic and institutional requirements
export const INITIAL_LANGUAGES: SupportedLanguage[] = [
  {
    code: 'amh',
    name: 'Amharic',
    nativeName: 'አማርኛ',
    script: 'Ethiopic',
    variants: ['Gondar', 'Wollo', 'Shewa', 'Gojjam'],
    isActive: true,
  },
  {
    code: 'orm',
    name: 'Afaan Oromoo',
    nativeName: 'Afaan Oromoo',
    script: 'Latin',
    variants: ['Central (Shewa)', 'Western (Wollega)', 'Eastern (Harar)', 'Southern (Boran)'],
    isActive: true,
  },
  {
    code: 'tir',
    name: 'Tigrinya',
    nativeName: 'ትግርኛ',
    script: 'Ethiopic',
    variants: ['Enderta', 'Adwa', 'Agame', 'Tembien'],
    isActive: true,
  },
  {
    code: 'som',
    name: 'Somali',
    nativeName: 'Af-Soomaali',
    script: 'Latin',
    variants: ['Ogaden', 'Jijiga', 'Shinile'],
    isActive: true,
  },
  {
    code: 'sid',
    name: 'Sidama',
    nativeName: 'Sidaamu Afoo',
    script: 'Latin',
    variants: ['Hawassa', 'Aleta Wondo', 'Yirgalem'],
    isActive: true,
  },
  {
    code: 'wal',
    name: 'Wolaytta',
    nativeName: 'Wolayttatto Doonaa',
    script: 'Latin',
    variants: ['Soddo', 'Areka', 'Boditi'],
    isActive: true,
  },
  {
    code: 'gur',
    name: 'Gurage',
    nativeName: 'ጉራጊኛ',
    script: 'Ethiopic',
    variants: ['Sebat Bet', 'Silt\'e', 'Kistane (Soddo)'],
    isActive: true,
  },
  {
    code: 'aar',
    name: 'Afar',
    nativeName: 'Qafaraf',
    script: 'Latin',
    variants: ['Northern', 'Central', 'Southern (Assab)'],
    isActive: true,
  },
  {
    code: 'had',
    name: 'Hadiyya',
    nativeName: 'Hadiyyisa',
    script: 'Latin',
    variants: ['Hosanna', 'Lemo', 'Shashogo'],
    isActive: true,
  },
  {
    code: 'gam',
    name: 'Gamo',
    nativeName: 'Gamotto',
    script: 'Latin',
    variants: ['Arba Minch', 'Chencha'],
    isActive: true,
  },
  {
    code: 'eng',
    name: 'English',
    nativeName: 'English',
    script: 'Latin',
    variants: ['International', 'Standard British', 'Standard American'],
    isActive: true,
  },
  {
    code: 'ara',
    name: 'Arabic',
    nativeName: 'العربية',
    script: 'Arabic',
    variants: ['Modern Standard', 'Gulf', 'Yemeni / Red Sea Dialect'],
    isActive: true,
  },
];

// Pre-seeded Users across all in-scope roles:
// - Organizations/Clients have two distinct accounts: Admin Account & Common Staff Terminal Account
// - Certified Interpreters, Supervisors, and Platform Administrators
export const INITIAL_USERS: User[] = [
  {
    id: 'usr-client-admin-1',
    email: 'admin.bekele@tikuranbessa.gov.et',
    fullName: 'Dr. Solomon Bekele (Hospital Admin)',
    role: 'client',
    clientAccountType: 'organization_admin',
    phone: '+251 91 123 4567',
    organizationName: 'Tikur Anbessa Specialized Hospital (Addis Ababa)',
    status: 'active',
    createdAt: '2026-08-10T08:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-client-common-1',
    email: 'triage.desk@tikuranbessa.gov.et',
    fullName: 'Emergency Triage Desk #1 (Common Staff Terminal)',
    role: 'client',
    clientAccountType: 'common_terminal',
    phone: '+251 91 123 4599',
    organizationName: 'Tikur Anbessa Specialized Hospital (Addis Ababa)',
    status: 'active',
    createdAt: '2026-08-12T08:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-client-admin-2',
    email: 'admin.tadesse@moj.gov.et',
    fullName: 'Meron Tadesse, Legal Director (Court Admin)',
    role: 'client',
    clientAccountType: 'organization_admin',
    phone: '+251 92 234 5678',
    organizationName: 'Federal First Instance Court (Arada Bench)',
    status: 'active',
    createdAt: '2026-08-15T09:30:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-client-common-2',
    email: 'registry.desk@moj.gov.et',
    fullName: 'Bench Room 3 Registry (Common Staff Terminal)',
    role: 'client',
    clientAccountType: 'common_terminal',
    phone: '+251 92 234 5699',
    organizationName: 'Federal First Instance Court (Arada Bench)',
    status: 'active',
    createdAt: '2026-08-18T09:30:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-interp-1',
    email: 'chaltu.kebede@interpreters.et',
    fullName: 'Chaltu Kebede',
    role: 'interpreter',
    phone: '+251 91 555 0101',
    organizationName: 'National Accredited Interpreters Registry',
    status: 'active',
    createdAt: '2026-07-01T11:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-interp-2',
    email: 'berhane.gebre@interpreters.et',
    fullName: 'Berhane Gebremariam',
    role: 'interpreter',
    phone: '+251 91 555 0202',
    organizationName: 'Ethiopian Judicial & Medical Interpreters Corps',
    status: 'active',
    createdAt: '2026-07-05T12:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-interp-3',
    email: 'faduma.omar@interpreters.et',
    fullName: 'Faduma Omar Hassan',
    role: 'interpreter',
    phone: '+251 91 555 0303',
    organizationName: 'Eastern Horn Linguistic Services',
    status: 'active',
    createdAt: '2026-07-12T14:15:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-interp-4',
    email: 'tariku.wonche@interpreters.et',
    fullName: 'Tariku Wonche',
    role: 'interpreter',
    phone: '+251 91 555 0404',
    organizationName: 'Southern Regional Language Guild',
    status: 'active',
    createdAt: '2026-08-01T09:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-super-1',
    email: 'rahel.alemu@elip.et',
    fullName: 'Rahel Alemu',
    role: 'supervisor',
    phone: '+251 91 777 0001',
    organizationName: 'Central Operations Dispatch Centre (Addis Ababa)',
    status: 'active',
    createdAt: '2026-06-01T08:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr-admin-1',
    email: 'admin.dawit@elip.et',
    fullName: 'Dawit Mengistu',
    role: 'platform_admin',
    phone: '+251 91 888 9999',
    organizationName: 'Ministry of Innovation & Technology / ELIP Operations',
    status: 'active',
    createdAt: '2026-05-15T08:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  },
];

// Pre-seeded Interpreter Profiles with certified language pairs and qualifications
export const INITIAL_INTERPRETERS: InterpreterProfile[] = [
  {
    id: 'int-1',
    userId: 'usr-interp-1',
    fullName: 'Chaltu Kebede',
    phone: '+251 91 555 0101',
    email: 'chaltu.kebede@interpreters.et',
    supportedLanguages: [
      { languageCode: 'orm', proficiency: 'native', pairDirection: 'bidirectional' },
      { languageCode: 'amh', proficiency: 'fluent', pairDirection: 'bidirectional' },
      { languageCode: 'eng', proficiency: 'professional', pairDirection: 'bidirectional' },
    ],
    serviceCategories: ['healthcare', 'public_services', 'ngo_humanitarian', 'education'],
    qualifications: [
      {
        id: 'q-1',
        title: 'Certified Medical Interpreter (Oromifa/Amharic)',
        category: 'healthcare',
        issuingBody: 'Ethiopian Medical Association & Ministry of Health',
        year: 2024,
        verified: true,
        documentRef: 'DOC-EMA-2024-984',
      },
      {
        id: 'q-2',
        title: 'Community & NGO Field Interpretation Diploma',
        category: 'ngo_humanitarian',
        issuingBody: 'Addis Ababa University Institute of Language Studies',
        year: 2022,
        verified: true,
        documentRef: 'DOC-AAU-2022-104',
      },
    ],
    verificationState: 'verified',
    availability: 'available',
    rating: 4.9,
    totalSessionsCompleted: 142,
    currentWorkstation: 'Bole Terminal Station #4',
  },
  {
    id: 'int-2',
    userId: 'usr-interp-2',
    fullName: 'Berhane Gebremariam',
    phone: '+251 91 555 0202',
    email: 'berhane.gebre@interpreters.et',
    supportedLanguages: [
      { languageCode: 'tir', proficiency: 'native', pairDirection: 'bidirectional' },
      { languageCode: 'amh', proficiency: 'native', pairDirection: 'bidirectional' },
      { languageCode: 'eng', proficiency: 'professional', pairDirection: 'bidirectional' },
    ],
    serviceCategories: ['legal_court', 'immigration', 'healthcare', 'public_services'],
    qualifications: [
      {
        id: 'q-3',
        title: 'Federal Judicial Sworn Interpreter Credential',
        category: 'legal_court',
        issuingBody: 'Federal Supreme Court of Ethiopia',
        year: 2023,
        verified: true,
        documentRef: 'DOC-FSC-2023-772',
      },
      {
        id: 'q-4',
        title: 'Trauma-Informed Legal Intake Certification',
        category: 'immigration',
        issuingBody: 'International Commission of Jurists - East Africa',
        year: 2024,
        verified: true,
        documentRef: 'DOC-ICJ-2024-301',
      },
    ],
    verificationState: 'verified',
    availability: 'available',
    rating: 4.95,
    totalSessionsCompleted: 218,
    currentWorkstation: 'Judicial Coordination Hub',
  },
  {
    id: 'int-3',
    userId: 'usr-interp-3',
    fullName: 'Faduma Omar Hassan',
    phone: '+251 91 555 0303',
    email: 'faduma.omar@interpreters.et',
    supportedLanguages: [
      { languageCode: 'som', proficiency: 'native', pairDirection: 'bidirectional' },
      { languageCode: 'amh', proficiency: 'fluent', pairDirection: 'bidirectional' },
      { languageCode: 'ara', proficiency: 'fluent', pairDirection: 'bidirectional' },
      { languageCode: 'eng', proficiency: 'professional', pairDirection: 'bidirectional' },
    ],
    serviceCategories: ['healthcare', 'immigration', 'ngo_humanitarian'],
    qualifications: [
      {
        id: 'q-5',
        title: 'Refugee and Cross-Border Intake Interpreter',
        category: 'ngo_humanitarian',
        issuingBody: 'UNHCR / IOM Ethiopia Joint Training Board',
        year: 2024,
        verified: true,
        documentRef: 'DOC-UN-2024-551',
      },
      {
        id: 'q-6',
        title: 'Somali-Amharic Clinical Communication Certificate',
        category: 'healthcare',
        issuingBody: 'Jijiga Regional Health Bureau',
        year: 2025,
        verified: true,
        documentRef: 'DOC-JRHB-2025-089',
      },
    ],
    verificationState: 'verified',
    availability: 'available',
    rating: 4.88,
    totalSessionsCompleted: 98,
    currentWorkstation: 'Eastern Sector Dispatch Desk',
  },
  {
    id: 'int-4',
    userId: 'usr-interp-4',
    fullName: 'Tariku Wonche',
    phone: '+251 91 555 0404',
    email: 'tariku.wonche@interpreters.et',
    supportedLanguages: [
      { languageCode: 'sid', proficiency: 'native', pairDirection: 'bidirectional' },
      { languageCode: 'wal', proficiency: 'fluent', pairDirection: 'bidirectional' },
      { languageCode: 'amh', proficiency: 'fluent', pairDirection: 'bidirectional' },
    ],
    serviceCategories: ['healthcare', 'public_services', 'education'],
    qualifications: [
      {
        id: 'q-7',
        title: 'Southern Nations Healthcare Interpreter License',
        category: 'healthcare',
        issuingBody: 'Hawassa University Comprehensive Specialized Hospital',
        year: 2023,
        verified: true,
        documentRef: 'DOC-HUCSH-2023-412',
      },
    ],
    verificationState: 'verified',
    availability: 'busy',
    rating: 4.82,
    totalSessionsCompleted: 76,
    currentWorkstation: 'Hawassa Regional Desk',
  },
];

// Initial requests demonstrating various states per SRS Section 8
export const INITIAL_REQUESTS: InterpretationRequest[] = [
  {
    reference: 'REQ-2026-10821',
    requesterId: 'usr-client-1',
    requesterName: 'Dr. Solomon Bekele',
    requesterPhone: '+251 91 123 4567',
    organizationName: 'Tikur Anbessa Specialized Hospital',
    sourceLanguage: 'orm',
    targetLanguage: 'amh',
    isUnknownLanguage: false,
    serviceCategory: 'healthcare',
    urgency: 'emergency',
    modality: 'audio',
    scheduleType: 'immediate',
    status: 'assigned',
    minRoutingContext: 'Emergency triage: Patient arriving with acute respiratory trauma, primary speech Oromo only. Need urgent medical triage communication.',
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    assignedInterpreterId: 'int-1',
    assignedInterpreterName: 'Chaltu Kebede',
    activeSessionId: 'SES-9921',
  },
  {
    reference: 'REQ-2026-10822',
    requesterId: 'usr-client-2',
    requesterName: 'Meron Tadesse, Legal Counsel',
    requesterPhone: '+251 92 234 5678',
    organizationName: 'Federal First Instance Court (Arada Bench)',
    sourceLanguage: 'tir',
    targetLanguage: 'amh',
    isUnknownLanguage: false,
    serviceCategory: 'legal_court',
    urgency: 'high',
    modality: 'video',
    scheduleType: 'immediate',
    status: 'matching',
    minRoutingContext: 'Witness testimony examination in civil dispute. Court requires sworn interpreter for formal proceeding.',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
  },
  {
    reference: 'REQ-2026-10823',
    requesterId: 'usr-client-3',
    requesterName: 'Khalid Ahmed, Protection Officer',
    requesterPhone: '+251 93 345 6789',
    organizationName: 'UNHCR Dollo Ado Transit Centre',
    sourceLanguage: 'som',
    targetLanguage: 'eng',
    isUnknownLanguage: false,
    serviceCategory: 'immigration',
    urgency: 'standard',
    modality: 'phone_assisted',
    scheduleType: 'scheduled',
    scheduledTime: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
    status: 'submitted',
    minRoutingContext: 'Family reunification intake verification at field tent 4. Speakerphone setup on site.',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    reference: 'REQ-2026-10824',
    requesterId: 'usr-client-1',
    requesterName: 'Dr. Solomon Bekele',
    requesterPhone: '+251 91 123 4567',
    organizationName: 'Tikur Anbessa Specialized Hospital',
    sourceLanguage: 'unknown',
    targetLanguage: 'amh',
    isUnknownLanguage: true,
    unknownLanguageNotes: 'Patient arrived from rural border area; dialect unrecognized by ward staff. Family says origin is southern Oromia / Guji highland pocket. Sounds like Borana or Guji dialect variant.',
    serviceCategory: 'healthcare',
    urgency: 'emergency',
    modality: 'audio',
    scheduleType: 'immediate',
    status: 'pending_coordinator',
    minRoutingContext: 'Pediatric unit intake. Urgent need to identify exact dialect to communicate medication dosages.',
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    escalatedToSupervisorAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    escalationReason: 'Unknown language intake flagged - escalated to supervisor coordinator without automated guessing per SRS FR-017 & 7.3.',
  },
  {
    reference: 'REQ-2026-10819',
    requesterId: 'usr-client-2',
    requesterName: 'Meron Tadesse, Legal Counsel',
    requesterPhone: '+251 92 234 5678',
    organizationName: 'Federal First Instance Court (Arada Bench)',
    sourceLanguage: 'sid',
    targetLanguage: 'amh',
    isUnknownLanguage: false,
    serviceCategory: 'legal_court',
    urgency: 'standard',
    modality: 'audio',
    scheduleType: 'immediate',
    status: 'completed',
    minRoutingContext: 'Deposition review with plaintiff regarding contract terms.',
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    assignedInterpreterId: 'int-4',
    assignedInterpreterName: 'Tariku Wonche',
    activeSessionId: 'SES-9915',
  },
];

// Initial Sessions
export const INITIAL_SESSIONS: InterpretationSession[] = [
  {
    id: 'SES-9921',
    requestReference: 'REQ-2026-10821',
    sessionToken: 'SES-TOKEN-e89a24cf',
    status: 'ready_to_join',
    communicationMode: 'audio',
    lowBandwidthMode: true,
    recordingEnabled: false,
    durationSeconds: 0,
    interpreterId: 'int-1',
    interpreterName: 'Chaltu Kebede',
    clientId: 'usr-client-1',
    clientName: 'Dr. Solomon Bekele',
    organizationName: 'Tikur Anbessa Specialized Hospital',
    sourceLanguage: 'orm',
    targetLanguage: 'amh',
    serviceCategory: 'healthcare',
    connectionHealth: 'optimal',
    authorizedParticipantIds: ['usr-client-1', 'usr-interp-1'],
  },
  {
    id: 'SES-9915',
    requestReference: 'REQ-2026-10819',
    sessionToken: 'SES-TOKEN-completed-773a',
    status: 'completed',
    communicationMode: 'audio',
    lowBandwidthMode: true,
    recordingEnabled: false,
    startedAt: new Date(Date.now() - 1000 * 60 * 165).toISOString(),
    endedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    durationSeconds: 2700,
    interpreterId: 'int-4',
    interpreterName: 'Tariku Wonche',
    clientId: 'usr-client-2',
    clientName: 'Meron Tadesse, Legal Counsel',
    organizationName: 'Federal First Instance Court',
    sourceLanguage: 'sid',
    targetLanguage: 'amh',
    serviceCategory: 'legal_court',
    connectionHealth: 'optimal',
    authorizedParticipantIds: ['usr-client-2', 'usr-interp-4'],
  },
];

// Initial Assignments
export const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: 'asg-901',
    requestReference: 'REQ-2026-10821',
    interpreterId: 'int-1',
    interpreterName: 'Chaltu Kebede',
    assignedAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 2).toISOString(),
    response: 'accepted',
    respondedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    outcome: 'accepted',
  },
];

// Initial Completion Reports
export const INITIAL_COMPLETIONS: CompletionReport[] = [
  {
    id: 'cmp-501',
    sessionId: 'SES-9915',
    requestReference: 'REQ-2026-10819',
    interpreterId: 'int-4',
    interpreterName: 'Tariku Wonche',
    outcome: 'completed',
    durationMinutes: 45,
    issueCode: 'none',
    notes: 'Deposition statement interpreted accurately between Sidama speaker and presiding attorney. No dialect barriers encountered.',
    reviewStatus: 'standard',
    clientFeedback: {
      rating: 5,
      comment: 'Very professional legal terminology handling and clear acoustic connection.',
      submittedAt: new Date(Date.now() - 1000 * 60 * 115).toISOString(),
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
];

// Initial Platform Settings
export const INITIAL_SETTINGS: PlatformSettings = {
  assignmentTimeoutSeconds: 45,
  maxAutoRetries: 3,
  emergencyPriorityBypass: true,
  allowDirectRecording: false, // strictly false per SRS FR-016 & 7.4
  maintenanceMode: false,
  telecomLowBandwidthPreset: true, // optimized for Ethio Telecom / Safaricom Ethiopia 3G/4G stability
  systemBannerNotice: 'Platform operational across Addis Ababa, Oromia, Tigray, Somali, and Sidama regional health & judicial hubs.',
};

// Initial Notifications
export const INITIAL_NOTIFICATIONS: PlatformNotification[] = [
  {
    id: 'notif-1',
    recipientId: 'usr-interp-1',
    title: 'Emergency Healthcare Request Assigned',
    message: 'New request REQ-2026-10821: Oromo to Amharic at Tikur Anbessa Hospital.',
    channel: 'in_app',
    status: 'delivered',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    actionUrl: '/interpreter',
  },
  {
    id: 'notif-2',
    recipientId: 'usr-super-1',
    title: 'Unknown Language Escalation Alert',
    message: 'REQ-2026-10824 flagged as unknown language from Tikur Anbessa pediatric unit. Coordinator review required.',
    channel: 'in_app',
    status: 'delivered',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    actionUrl: '/supervisor',
  },
];

// Initial Audit Logs (Strictly preserving non-tamperable security events per SRS FR-066 & 7.5)
export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud-001',
    correlationId: 'cor-88192a-01',
    actorId: 'usr-admin-1',
    actorName: 'Dawit Mengistu',
    actorRole: 'platform_admin',
    action: 'INTERPRETER_QUALIFICATION_VERIFIED',
    resourceType: 'interpreter_profile',
    resourceId: 'int-1',
    result: 'success',
    timestamp: '2026-08-01T10:14:22Z',
    securityMetadata: {
      ip: '197.156.104.12',
      userAgent: 'ELIP-Console/1.0',
      note: 'Verified Medical credential against Ethiopian Medical Association registry',
    },
  },
  {
    id: 'aud-002',
    correlationId: 'cor-88192a-02',
    actorId: 'usr-client-1',
    actorName: 'Dr. Solomon Bekele',
    actorRole: 'client',
    action: 'REQUEST_SUBMITTED',
    resourceType: 'interpretation_request',
    resourceId: 'REQ-2026-10821',
    result: 'success',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    securityMetadata: {
      ip: '197.156.98.54',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      note: 'Urgency: emergency; Category: healthcare',
    },
  },
  {
    id: 'aud-003',
    correlationId: 'cor-88192a-03',
    actorId: 'system',
    actorName: 'Dispatch Engine',
    actorRole: 'platform_admin',
    action: 'INTERPRETER_MATCHED_AND_ASSIGNED',
    resourceType: 'assignment',
    resourceId: 'asg-901',
    result: 'success',
    timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    securityMetadata: {
      note: 'Interpreter Chaltu Kebede matched based on native Oromo, healthcare cert, and live availability.',
    },
  },
  {
    id: 'aud-004',
    correlationId: 'cor-88192a-04',
    actorId: 'usr-client-1',
    actorName: 'Dr. Solomon Bekele',
    actorRole: 'client',
    action: 'UNKNOWN_LANGUAGE_ESCALATED',
    resourceType: 'interpretation_request',
    resourceId: 'REQ-2026-10824',
    result: 'success',
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    securityMetadata: {
      note: 'Flagged as unknown language; routed directly to supervisor workspace per safety protocol.',
    },
  },
];

// In-Memory Database store instance with getter and mutation methods
class DatabaseStore {
  languages: SupportedLanguage[] = [...INITIAL_LANGUAGES];
  users: User[] = [...INITIAL_USERS];
  interpreters: InterpreterProfile[] = [...INITIAL_INTERPRETERS];
  requests: InterpretationRequest[] = [...INITIAL_REQUESTS];
  assignments: Assignment[] = [...INITIAL_ASSIGNMENTS];
  sessions: InterpretationSession[] = [...INITIAL_SESSIONS];
  sessionParticipants: SessionParticipant[] = [];
  completions: CompletionReport[] = [...INITIAL_COMPLETIONS];
  notifications: PlatformNotification[] = [...INITIAL_NOTIFICATIONS];
  auditLogs: AuditLog[] = [...INITIAL_AUDIT_LOGS];
  settings: PlatformSettings = { ...INITIAL_SETTINGS };

  // Current active user session (simulates the authenticated context)
  currentUserId: string | null = 'usr-client-admin-1';

  getCurrentUser(): User | null {
    if (!this.currentUserId) return null;
    const user = this.users.find(u => u.id === this.currentUserId);
    return user || null;
  }

  setCurrentUser(userId: string): User {
    const user = this.users.find(u => u.id === userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    this.currentUserId = userId;
    this.logAudit({
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'USER_ROLE_SWITCH',
      resourceType: 'user_session',
      resourceId: user.id,
      result: 'success',
      securityMetadata: { note: `Switched active role perspective to ${user.role}` },
    });
    return user;
  }

  logout(): void {
    if (this.currentUserId) {
      const user = this.users.find(u => u.id === this.currentUserId);
      if (user) {
        this.logAudit({
          actorId: user.id,
          actorName: user.fullName,
          actorRole: user.role,
          action: 'USER_LOGOUT',
          resourceType: 'user_session',
          resourceId: user.id,
          result: 'success',
          securityMetadata: { note: 'User session logged out' },
        });
      }
    }
    this.currentUserId = null;
  }

  logAudit(entry: Omit<AuditLog, 'id' | 'correlationId' | 'timestamp'>) {
    const newLog: AuditLog = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      correlationId: `cor-${Math.random().toString(36).substring(2, 10)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.auditLogs.unshift(newLog);
    // keep maximum 500 audit logs in memory
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
    return newLog;
  }

  createNotification(notif: Omit<PlatformNotification, 'id' | 'createdAt'>) {
    const item: PlatformNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      ...notif,
    };
    this.notifications.unshift(item);
    return item;
  }
}

export const db = new DatabaseStore();
