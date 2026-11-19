export const PROGRAMS = [
    ['nursing', 'Nursing', '1551061136856584254'],
    ['dental-hygiene', 'Dental Hygiene', '1550400239263809647'],
    ['dental-assisting', 'Dental Assisting', '1550398526356193371'],
    ['radiography', 'X-Ray Technology', '1550389353740636191'],
    ['sonography', 'Ultrasound Technology', '1550392240336150548'],
    ['respiratory', 'Respiratory Therapy', '1550377197326434324'],
    ['pta', 'Physical Therapist Assistant', '1550379732598661201'],
    ['pa', 'Physician Assistant', '1565181634230231081'],
    ['medicine', 'Medicine', '1565181460384718869'],
].map(([id, name, emoji]) => ({ id, name, emoji }));
export const TOPICS = ['admissions', 'prerequisites', 'deadlines', 'licensing', 'accreditation', 'scholarships', 'tuition'];
export const APPLICANTS = ['all', 'domestic', 'international', 'transfer'];
export const program = id => PROGRAMS.find(p => p.id === id);
export function countryCode(value) {
    const code = String(value || '').trim().toUpperCase();
    const name = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
    if (!/^[A-Z]{2}$/.test(code) || !name.of(code)) throw new Error('Use a two-letter country code, such as US, CA, GB, AU, IN, or ZA.');
    return code;
}
export const countryName = code => new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
const normalized = value => String(value || '').normalize('NFKC').trim().toLowerCase();
export function preferences(input) {
    if (!program(input.program)) throw new Error('Choose one of the nine supported programs.');
    if (input.topic && !TOPICS.includes(input.topic)) throw new Error('Choose a supported update topic.');
    if (input.applicant && !APPLICANTS.includes(input.applicant)) throw new Error('Choose a supported applicant type.');
    return { program: input.program, country: countryCode(input.country), region: String(input.region || '').trim().slice(0, 80), county: String(input.county || '').trim().slice(0, 80),
        school: String(input.school || '').trim().slice(0, 120), topic: input.topic || '', applicant: input.applicant || 'all' };
}
export function matches(source, filter) {
    return source.program === filter.program && source.country === filter.country
        && (!filter.region || !source.region || normalized(source.region) === normalized(filter.region))
        && (!filter.county || !source.county || normalized(source.county) === normalized(filter.county))
        && (!filter.school || normalized(source.school).includes(normalized(filter.school)))
        && (!filter.topic || source.topic === filter.topic)
        && (filter.applicant === 'all' || !source.applicant || source.applicant === 'all' || source.applicant === filter.applicant);
}
// Official directories are navigation aids, not a database of admission requirements.
export const DIRECTORIES = {
    nursing: [['US', 'CCNE accredited programs', 'https://www.aacnnursing.org/ccne-accreditation'], ['GB', 'NMC approved programmes', 'https://www.nmc.org.uk/education/approved-programmes/']],
    'dental-hygiene': [['US', 'CODA programme search', 'https://coda.ada.org/find-a-program/']],
    'dental-assisting': [['US', 'CODA programme search', 'https://coda.ada.org/find-a-program/']],
    radiography: [['US', 'JRCERT programme search', 'https://www.jrcert.org/find-a-program/']],
    sonography: [['US', 'CAAHEP programme search', 'https://www.caahep.org/students/find-an-accredited-program']],
    respiratory: [['US', 'CoARC programme information', 'https://coarc.com/students/']],
    pta: [['US', 'CAPTE accredited programmes', 'https://www.capteonline.org/']],
    pa: [['US', 'ARC-PA accredited programmes', 'https://www.arc-pa.org/accreditation/accredited-programs/']],
    medicine: [['US', 'AAMC medical school admissions', 'https://students-residents.aamc.org/'], ['GB', 'GMC medical schools', 'https://www.gmc-uk.org/education/medical-school-courses-and-curricula']],
};
