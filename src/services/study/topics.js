// One category per uploaded presentation. Keep the total below Discord's 25-option limit.
export const STUDY_TOPICS = [
    ['anatomical_directions', 'Anatomical Directions', 'Anatomical Directions Chapter 1.pptx', 'Learn body regions, directions, and anatomical terms'],
    ['basic_chemistry', 'Basic Chemistry', 'Basic Chemistry Chapter 2.pptx', 'Explore the chemistry behind body functions'],
    ['living_cells', 'Living Cells', 'Living Cells Units Chapter 3.pptx', 'Discover cell structures and how they work'],
    ['tissues', 'Tissues', 'Tissues Chapter 4.pptx', 'Learn the tissues that build the body'],
    ['integumentary', 'Integumentary System', 'Integumentary System Chapter 5.pptx', 'Explore skin, hair, nails, and body protection'],
    ['skeletal', 'Skeletal System', 'Skeletal System Chpter 6.pptx', 'Explore bones and their functions'],
    ['joints', 'Joints', 'Joints Chapter 9.pptx', 'Learn how joints connect bones and allow movement'],
    ['muscular', 'Muscular System', 'Muscular System Chapter 10.pptx', 'Discover muscles, contraction, and movement'],
    ['nervous_tissue', 'Nervous System & Nervous Tissue', 'Nervous System and Nervous Tissue Chapter 12.pptx', 'Explore neurons and nerve signaling'],
    ['central_nervous', 'Central Nervous System', 'Central Nervous System Chapter 13.pptx', 'Study the brain and spinal cord'],
    ['autonomic_nervous', 'Autonomic Nervous System', 'Automatic Nervous System Chapter 14.pptx', 'Explore automatic control of body functions'],
    ['special_senses', 'Special Senses', 'Special Senses Chapter 15.pptx', 'Discover vision, hearing, balance, taste, and smell'],
    ['endocrine', 'Endocrine System', 'Endocrine System Chapter 16.pptx', 'Learn hormones and how they regulate the body'],
    ['blood_cells', 'Blood Cells', 'Blood Cells Chapter 18.pptx', 'Explore blood cells, clotting, and oxygen transport'],
    ['circulatory', 'Circulatory System', 'Circulatory System Chapter 19.pptx', 'Study the heart and blood flow'],
    ['blood_vessels', 'Blood Vessels', 'Blood Vessels Chapter 20.pptx', 'Explore vessels, circulation routes, and blood pressure'],
    ['immune', 'Immune System', 'Immune System Chapter 21 Part A.pptx', 'Learn how the body recognizes and fights threats'],
    ['lymphatic', 'Lymphatic System', 'Lymphatic System Chapter 21 part 2.pptx', 'Explore lymph flow, lymph nodes, and immune organs'],
    ['respiratory', 'Respiratory System', 'Respiratory System Chapter 22.pptx', 'Explore breathing and gas exchange'],
    ['digestive', 'Digestive System', 'Digestive System Chapter 23.pptx', 'Follow digestion, nutrients, and absorption'],
    ['urinary', 'Urinary System', 'Urinary System Chapter 24.pptx', 'Explore kidneys, filtration, and urine formation'],
    ['fluid_balance', 'Water & Fluid Balance', 'Water Fluid Balance Chapter 25.pptx', 'Learn fluid, electrolyte, and acid-base balance'],
    ['reproductive', 'Reproductive System', 'Reproductive System Chapter 26.pptx', 'Explore reproductive anatomy, hormones, and cycles'],
].map(([id, label, source, description], index) => Object.freeze({ id, label, source, description, target: 600, emoji: [
    '🧍', '🧪', '🔬', '🧫', '🧴', '🦴', '🦿', '💪', '🧠', '🧠', '⚡', '👁️', '🧪', '🩸', '❤️', '🩺', '🛡️', '💚', '🫁', '🍽️', '💧', '⚖️', '🧬',
][index] }));

export const TOPIC_BY_ID = new Map(STUDY_TOPICS.map(topic => [topic.id, topic]));
