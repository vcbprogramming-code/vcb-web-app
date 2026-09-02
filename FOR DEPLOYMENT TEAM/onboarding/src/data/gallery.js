// Ported from the original app's PAGES['meet-our-team'] and
// PAGES['life-on-site'] (content.html) — text verbatim from the source.
//
// The photographs are extracted from images.html, where the original carries
// them as base64 data URIs, and referenced here by path. Filenames are the
// kebab-cased EMBEDDED_IMAGES key, so each file is traceable to its source.

export const MEET_OUR_TEAM = {
  eyebrow: 'Our People',
  title: 'Meet Our Team',
  intro: {
    heading: 'Life at Vichitbhan Construction',
    body: [
      'Beyond the job site and the ledgers, VCB is a team that shows up for each other — company parties, seasonal gatherings, and the everyday moments that make a construction company feel like more than a construction company.',
      'These are some of those moments.',
    ],
  },
  // type: 'trackrecord' in the original — the same carousel Home uses.
  reels: [
    {
      heading: 'New Year Party 2019',
      subheading: 'Costumes, awards, and a company-wide celebration to close out the year.',
      slides: [
        { image: '/img/meet-team-nyp2019-award.jpg', caption: 'New Year Party 2019' },
        { image: '/img/meet-team-nyp-award-stage.jpg', caption: 'Best Dressed Award' },
        { image: '/img/meet-team-party-group1.jpg', caption: 'Company Costume Party' },
      ],
    },
    {
      heading: 'Company Celebration',
      subheading: 'More moments from company gatherings over the years.',
      slides: [
        { image: '/img/meet-team-party-candid1.jpg', caption: 'Company Celebration' },
        { image: '/img/meet-team-party-candid2.jpg', caption: 'Company Celebration' },
        { image: '/img/meet-team-party-candid3.jpg', caption: 'Company Celebration' },
        { image: '/img/meet-team-party-candid4.jpg', caption: 'Company Celebration' },
      ],
    },
    {
      heading: 'Christmas Gathering',
      subheading: 'Seasonal get-togethers with the wider VCB team.',
      slides: [
        { image: '/img/meet-team-christmas2023a.jpg', caption: 'Christmas Gathering 2023' },
        { image: '/img/meet-team-christmas2023b.jpg', caption: 'Christmas Gathering 2023' },
        { image: '/img/meet-team-christmas-group.jpg', caption: 'Christmas Gathering' },
      ],
    },
  ],
};

export const LIFE_ON_SITE = {
  eyebrow: 'On the Ground',
  title: 'Life on Site',
  intro:
    'Site operations are carried out in a structured and controlled environment, with a focus on safety, coordination, and adherence to defined work processes.',
  // type: 'gallery' in the original — a grid, not a carousel.
  galleries: [
    {
      heading: 'Safety Talk',
      body: 'Each workday begins with a safety briefing to highlight potential risks, review ongoing activities, and reinforce site safety requirements. This ensures all personnel are aware of current site conditions, hazards, and control measures before work begins. Safety talks also provide an opportunity to address recent incidents, clarify procedures, and maintain a high level of safety awareness.',
      images: [{ image: '/img/los-safety-real1.jpg' }, { image: '/img/los-safety-real2.jpg' }],
    },
    {
      heading: 'Tool Box Talk',
      body: 'Toolbox talks are conducted regularly to review specific tasks and operational details relevant to the work being carried out. These sessions focus on correct methods, equipment usage, and coordination between teams. They ensure that all personnel understand their responsibilities and any task-specific risks before execution.',
      images: [{ image: '/img/los-toolbox-real1.jpg' }, { image: '/img/los-team-work-real.jpg' }],
    },
    {
      heading: 'Site Training',
      body: 'On-site training is provided to ensure personnel are equipped with the necessary knowledge and skills to perform their duties effectively. This includes training on equipment, procedures, and safety practices. Continuous training helps maintain consistency in work quality and ensures compliance with company standards and regulatory requirements.',
      images: [{ image: '/img/los-training-real1.jpg' }, { image: '/img/los-training-real2.jpg' }],
    },
    {
      heading: 'House Keeping',
      body: 'Housekeeping is maintained throughout the site to ensure a clean, organized, and safe working environment. Proper storage of materials, clear access routes, and regular removal of waste help reduce hazards and improve operational efficiency. Good housekeeping practices are essential to minimizing risks and maintaining site discipline.',
      images: [
        { image: '/img/los-housekeeping-real1.jpg' },
        { image: '/img/los-housekeeping-real2.jpg' },
      ],
    },
    {
      heading: 'Work in Process',
      body: 'All work activities are carried out in accordance with established procedures and project plans. Defined processes ensure consistency in execution, proper documentation, and alignment with cost and schedule requirements. Adherence to these processes supports quality control, accountability, and efficient resource utilization.',
      images: [
        { image: '/img/los-work-in-process-real1.jpg' },
        { image: '/img/los-work-in-process-real2.jpg' },
      ],
    },
    {
      // Navigation Lock, Power House Unit and Spillway were each their own
      // single-image gallery. content.html records why they were merged: one
      // image fills the whole row, stretching a landscape photo edge to edge.
      // Together the grid has enough tiles to lay out properly, each with its
      // own caption instead of a shared heading.
      heading: 'Site Facilities',
      images: [
        { image: '/img/los-navigation-lock-real.jpg', caption: 'Navigation Lock' },
        { image: '/img/los-power-house-real.jpg', caption: 'Power House Unit' },
        { image: '/img/los-spillway.jpg', caption: 'Spillway' },
      ],
    },
    {
      heading: 'Team Work',
      body: 'Site operations require coordination across multiple teams. Collaboration is at the heart of our success. We rely on each other’s strengths, communicate openly, and celebrate the achievements we build together.',
      images: [{ image: '/img/los-toolbox-real2.jpg' }],
    },
  ],
};
