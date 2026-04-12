# Judgment rollup: map citation URL domains to canonical organizations.
# Run: powershell -File tools/sdoh-org-rollup.ps1

$path = 'c:\Users\rexcr\Downloads\SDOH Citation Database.xlsx - Citations.csv'
$rows = Import-Csv -LiteralPath $path | Where-Object { $_.url -match '^https?://' }

# domain (lowercase host) -> canonical organization label
$map = @{
  '365.himss.org'                    = 'HIMSS'
  'academia.edu'                     = '[Platform: Academia.edu]'
  'aiib.org'                           = 'Asian Infrastructure Investment Bank (AIIB)'
  'alissarumsey.com'                 = 'Alissa Rumsey (practice)'
  'allergyasthmanetwork.org'         = 'Allergy & Asthma Network'
  'americanactionforum.org'          = 'American Action Forum'
  'ascopost.com'                       = 'ASCO / ASCO Post'
  'awttc.nhs.wales'                   = 'NHS Wales (AWTTC)'
  'cell.com'                           = 'Cell Press (Elsevier)'
  'ciss-journal.org'                  = 'CIS-S Journal'
  'commons.wikimedia.org'             = 'Wikimedia Commons'
  'confluence.hl7.org'                = 'HL7'
  'coursesidekick.com'                = 'Course Sidekick'
  'cswe.org'                           = 'Council on Social Work Education (CSWE)'
  'cuezen.com'                         = 'CueZen'
  'designsociety.org'                 = 'Design Society'
  'digitalhealth.org.au'              = 'Digital Health (Australia)'
  'discovery.ucl.ac.uk'               = 'University College London (UCL)'
  'dl.acm.org'                         = 'ACM Digital Library'
  'docs.google.com'                   = '[Platform: Google Docs]'
  'edhub.ama-assn.org'                = 'American Medical Association (AMA)'
  'elsevier.es'                        = 'Elsevier'
  'epa.gov'                            = 'US Environmental Protection Agency (EPA)'
  'europepmc.org'                      = 'NIH / Europe PMC (NLM-linked)'
  'eventornado.com'                   = 'Eventornado'
  'eversana.com'                       = 'Eversana'
  'facebook.com'                       = '[Platform: Meta / Facebook]'
  'fiercefatty.com'                   = 'Fierce Fatty (podcast/media)'
  'frontiersin.org'                   = 'Frontiers'
  'futureofcaregiving.com'            = 'Future of Caregiving'
  'goinvo.com'                         = 'GoInvo'
  'haringey.gov.uk'                   = 'London Borough of Haringey'
  'healthhumanitiessyllabi.rice.edu'  = 'Rice University'
  'healthitoutcomes.com'              = 'Health IT Outcomes'
  'healthlaw.osbar.org'               = 'Oregon State Bar'
  'healthpopuli.com'                  = 'Health Populi (blog)'
  'healthunchained.org'               = 'Health Unchained'
  'hrsa.gov'                           = 'Health Resources & Services Administration (HRSA)'
  'hub.uoa.gr'                         = 'National and Kapodistrian University of Athens'
  'instagram.com'                     = '[Platform: Instagram]'
  'issuu.com'                          = '[Platform: Issuu]'
  'journals.sagepub.com'              = 'Sage Publishing'
  'karunaforyou.com'                  = 'Karuna For You'
  'koenkas.com'                        = 'Koen Kas (author site)'
  'link.springer.com'                 = 'Springer Nature'
  'linkedin.com'                      = '[Platform: LinkedIn]'
  'logisticare.com'                   = 'Logisticare'
  'lscom.ch'                           = 'LSCOM'
  'magonlinelibrary.com'              = 'MA Healthcare / journal library'
  'malph.org'                          = 'Michigan Association for Local Public Health (MALPH)'
  'medbox.org'                         = 'MedBox'
  'medrxiv.org'                        = 'medRxiv (BMJ/CSHL/Yale)'
  'michelangelo-scholar.com'          = 'Michelangelo Scholar (journal)'
  'michigan.gov'                       = 'State of Michigan'
  'nctech.org'                         = 'NC TECH / North Carolina Tech'
  'nursekey.com'                      = 'NurseKey'
  'oha.com'                            = 'Ohio Hospital Association'
  'ojphi.jmir.org'                    = 'JMIR Publications'
  'onlinelibrary.wiley.com'           = 'Wiley'
  'ouci.dntb.gov.ua'                  = 'Ukrainian National Bibliography / OUCI'
  'outbreak.info'                     = 'outbreak.info (UCSD)'
  'pdfcoffee.com'                     = '[Aggregator: PDF host]'
  'peacefullynourished.ca'            = 'Peacefully Nourished'
  'pmc.ncbi.nlm.nih.gov'              = 'NIH / NLM (PubMed Central)'
  'podcasts.apple.com'                = '[Platform: Apple Podcasts]'
  'preprints.org'                     = 'Preprints.org (MDPI)'
  'prweb.com'                         = '[Wire: PRWeb / Cision]'
  'qualitysafety.bmj.com'             = 'BMJ'
  'quod.lib.umich.edu'                = 'University of Michigan'
  'realself.weebly.com'               = 'RealSelf (Weebly)'
  'reclaimingbeauty.com'              = 'Reclaiming Beauty'
  'researchgate.net'                  = '[Platform: ResearchGate]'
  'researchonline.rca.ac.uk'          = 'Royal College of Art'
  'sharonleedesign.com'               = 'Sharon Lee Design'
  'sites.uab.edu'                     = 'University of Alabama at Birmingham (UAB)'
  'summit.sfu.cahttps'                = 'Simon Fraser University (SFU)'
  'themillenniallegacy.com'           = 'The Millennial Legacy'
  'urbandesignforum.org'              = 'Urban Design Forum'
  'vorihealth.com'                    = 'Vori Health'
}

$canonical = [System.Collections.Generic.HashSet[string]]::new()
$platform = [System.Collections.Generic.HashSet[string]]::new()
$aggregator = [System.Collections.Generic.HashSet[string]]::new()

foreach ($r in $rows) {
  try {
    $uri = [Uri]$r.url
    $h = $uri.Host.ToLowerInvariant()
    if ($h.StartsWith('www.')) { $h = $h.Substring(4) }
    $label = $map[$h]
    if (-not $label) { $label = "[$h - unmapped]" }
    [void]$canonical.Add($label)
    if ($label -match '^\[Platform:') { [void]$platform.Add($label) }
    if ($label -match '^\[Aggregator:|\[Wire:') { [void]$aggregator.Add($label) }
  } catch {}
}

$substantive = $canonical | Where-Object { $_ -notmatch '^\[Platform:|\[Aggregator:|\[Wire:' }

Write-Host "=== SDOH citation rollup (judgment pass) ==="
Write-Host "Citation rows with URL: $($rows.Count)"
Write-Host "Unique canonical labels (all): $($canonical.Count)"
Write-Host "Unique substantive orgs (excl. Platform / Aggregator / Wire labels): $($substantive.Count)"
Write-Host ""
Write-Host "--- Substantive organizations ($($substantive.Count)) ---"
$substantive | Sort-Object
Write-Host ""
Write-Host "--- Platform / distribution (excluded from substantive count) ---"
$platform | Sort-Object
Write-Host ""
Write-Host "--- Aggregators / wire (excluded from substantive count) ---"
$aggregator | Sort-Object
