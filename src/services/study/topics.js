// One category per uploaded presentation. Keep the total below Discord's 25-option limit.
export const STUDY_TOPICS = [
    ['anatomical_directions', 'Anatomical Directions', 'Anatomical Directions Chapter 1.pptx'],
    ['basic_chemistry', 'Basic Chemistry', 'Basic Chemistry Chapter 2.pptx'],
    ['living_cells', 'Living Cells', 'Living Cells Units Chapter 3.pptx'],
    ['tissues', 'Tissues', 'Tissues Chapter 4.pptx'],
    ['integumentary', 'Integumentary System', 'Integumentary System Chapter 5.pptx'],
    ['skeletal', 'Skeletal System', 'Skeletal System Chpter 6.pptx'],
    ['joints', 'Joints', 'Joints Chapter 9.pptx'],
    ['muscular', 'Muscular System', 'Muscular System Chapter 10.pptx'],
    ['nervous_tissue', 'Nervous System & Nervous Tissue', 'Nervous System and Nervous Tissue Chapter 12.pptx'],
    ['central_nervous', 'Central Nervous System', 'Central Nervous System Chapter 13.pptx'],
    ['autonomic_nervous', 'Autonomic Nervous System', 'Automatic Nervous System Chapter 14.pptx'],
    ['special_senses', 'Special Senses', 'Special Senses Chapter 15.pptx'],
    ['endocrine', 'Endocrine System', 'Endocrine System Chapter 16.pptx'],
    ['blood_cells', 'Blood Cells', 'Blood Cells Chapter 18.pptx'],
    ['circulatory', 'Circulatory System', 'Circulatory System Chapter 19.pptx'],
    ['blood_vessels', 'Blood Vessels', 'Blood Vessels Chapter 20.pptx'],
    ['immune', 'Immune System', 'Immune System Chapter 21 Part A.pptx'],
    ['lymphatic', 'Lymphatic System', 'Lymphatic System Chapter 21 part 2.pptx'],
    ['respiratory', 'Respiratory System', 'Respiratory System Chapter 22.pptx'],
    ['digestive', 'Digestive System', 'Digestive System Chapter 23.pptx'],
    ['urinary', 'Urinary System', 'Urinary System Chapter 24.pptx'],
    ['fluid_balance', 'Water & Fluid Balance', 'Water Fluid Balance Chapter 25.pptx'],
    ['reproductive', 'Reproductive System', 'Reproductive System Chapter 26.pptx'],
].map(([id, label, source]) => Object.freeze({ id, label, source, target: 600 }));

export const TOPIC_BY_ID = new Map(STUDY_TOPICS.map(topic => [topic.id, topic]));
