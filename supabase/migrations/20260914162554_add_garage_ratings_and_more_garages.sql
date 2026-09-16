-- Add rating fields to garages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'garages' AND column_name = 'rating'
  ) THEN
    ALTER TABLE garages ADD COLUMN rating numeric(2,1) DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'garages' AND column_name = 'review_count'
  ) THEN
    ALTER TABLE garages ADD COLUMN review_count integer DEFAULT 0;
  END IF;
END $$;

-- Seed garages across Switzerland (various cantons and town sizes)
-- Lausanne area
UPDATE garages SET rating = 4.5, review_count = 23 WHERE name = 'AtelierPro Lausanne';

INSERT INTO garages (name, address, city, postal_code, phone, email, services_offered, latitude, longitude, rating, review_count)
VALUES
-- Vaud
('Garage du Léman', 'Rue du Port 8', 'Lutry', '1095', '+41 21 795 12 00', 'contact@garageduleman.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic'], 46.5065, 6.6853, 4.2, 8),
('Auto Center Chauderon', 'Place du Chauderon 5', 'Lausanne', '1003', '+41 21 311 22 33', 'info@autocenterchauderon.ch', ARRAY['Vidange','Freinage','Diagnostic','Révision générale','Suspension','Électricité'], 46.5233, 6.6347, 4.7, 31),
('Garage Pully Auto', 'Avenue de la Gare 22', 'Pully', '1009', '+41 21 729 45 67', 'pullyauto@garage.ch', ARRAY['Vidange','Pneus','Carrosserie'], 46.5100, 6.6570, 4.0, 5),
('Mécanique Morgienne', 'Rue du Pré 3', 'Morges', '1110', '+41 21 811 34 56', 'contact@morgienne.ch', ARRAY['Vidange','Freinage','Diagnostic','Révision générale','Électricité'], 46.5145, 6.4930, 4.3, 12),

-- Geneva
('Garage du Rhône', 'Quai du Rhône 12', 'Genève', '1205', '+41 22 320 11 22', 'contact@garagedurhone.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic','Révision générale','Suspension','Électricité','Carrosserie'], 46.2050, 6.1420, 4.6, 45),
('Auto Réparation Carouge', 'Route de Saint-Julien 45', 'Carouge', '1227', '+41 22 342 56 78', 'info@autocarouge.ch', ARRAY['Vidange','Freinage','Diagnostic','Électricité'], 46.1800, 6.1400, 4.1, 9),
('Garage de Vernier', 'Route de Meyrin 30', 'Vernier', '1214', '+41 22 795 33 44', 'vernier@garage.ch', ARRAY['Vidange','Pneus','Révision générale'], 46.2200, 6.0900, 3.9, 7),

-- Vaud countryside
('Garage du Jura Vaudois', 'Grand-Rue 15', 'Vallorbe', '1337', '+41 21 843 12 34', 'jura@atelierpro.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic'], 46.7050, 6.3500, 4.4, 6),
('Atelier du Chablais', 'Avenue du Simplon 18', 'Aigle', '1860', '+41 24 466 22 11', 'chablais@atelierpro.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic','Révision générale','Suspension'], 46.3167, 6.9667, 4.5, 14),
('Garage Payerne Motors', 'Rue de la Gare 7', 'Payerne', '1540', '+41 26 662 34 56', 'payerne@motors.ch', ARRAY['Vidange','Freinage','Diagnostic'], 46.8200, 6.9400, 3.8, 4),

-- Valais
('Garage du Rhône Valais', 'Avenue de la Gare 20', 'Sion', '1950', '+41 27 323 11 22', 'sion@garagedurhone.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic','Révision générale','Suspension','Électricité'], 46.2312, 7.3590, 4.3, 18),
('Atelier Martigny Auto', 'Avenue du Grand-Saint-Bernard 5', 'Martigny', '1920', '+41 27 722 33 44', 'martigny@auto.ch', ARRAY['Vidange','Freinage','Pneus','Carrosserie'], 46.1000, 7.0700, 4.0, 7),

-- Fribourg
('Garage de la Sarine', 'Boulevard de Pérolles 25', 'Fribourg', '1700', '+41 26 322 45 67', 'sarine@garage.ch', ARRAY['Vidange','Freinage','Diagnostic','Révision générale','Électricité'], 46.8060, 7.1570, 4.2, 11),
('Atelier Bulle Motors', 'Rue de la Gruyère 12', 'Bulle', '1630', '+41 26 912 34 56', 'bulle@motors.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic','Suspension'], 46.6150, 7.0580, 4.6, 22),

-- Neuchâtel / Jura
('Garage Neuchâtelois', 'Rue de la Colline 8', 'Neuchâtel', '2000', '+41 32 725 11 22', 'contact@garageneuchatelois.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic','Révision générale','Électricité','Carrosserie'], 47.0098, 6.9660, 4.4, 16),
('Atelier du Jura Bernois', 'Bahnhofstrasse 10', 'Biel/Bienne', '2502', '+41 32 322 45 67', 'biel@atelierjura.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic','Suspension'], 47.1370, 7.2460, 3.9, 8),

-- Bern
('Garage Bernois Central', 'Bremgartenstrasse 40', 'Bern', '3007', '+41 31 382 11 22', 'central@garagebernois.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic','Révision générale','Suspension','Électricité','Carrosserie'], 46.9420, 7.4360, 4.5, 28),
('Atelier Thun Auto', 'Seestrasse 15', 'Thun', '3600', '+41 33 222 33 44', 'thun@auto.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic'], 46.7580, 7.6280, 4.1, 10),

-- Basel
('Garage Bâlois du Rhin', 'St. Johanns-Vorstadt 22', 'Bâle', '4056', '+41 61 322 11 22', 'rhin@garagebasel.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic','Révision générale','Suspension','Électricité'], 47.5596, 7.5886, 4.3, 19),

-- Aargau
('Garage Aarau Motors', 'Bahnhofstrasse 30', 'Aarau', '5000', '+41 62 823 45 67', 'aarau@motors.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic','Révision générale'], 47.3920, 8.0440, 4.0, 9),

-- Zurich
('Auto Zürich Central', 'Bahnhofstrasse 50', 'Zürich', '8001', '+41 44 211 22 33', 'central@autozurich.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic','Révision générale','Suspension','Électricité','Carrosserie'], 47.3769, 8.5417, 4.7, 52),
('Garage Winterthur Nord', 'Technikumstrasse 12', 'Winterthur', '8400', '+41 52 212 33 44', 'nord@winterthur.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic','Électricité'], 47.5000, 8.7250, 4.2, 15),

-- St. Gallen
('Garage St-Gallois', 'Bahnhofstrasse 25', 'St. Gallen', '9000', '+41 71 222 33 44', 'contact@garagegallois.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic','Révision générale','Suspension'], 47.4245, 9.3767, 4.4, 13),

-- Lucerne
('Garage Lucernois Central', 'Pilatusstrasse 18', 'Lucerne', '6003', '+41 41 220 11 22', 'central@lucerne.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic','Révision générale','Suspension','Électricité','Carrosserie'], 47.0502, 8.3093, 4.5, 20),

-- Ticino
('Garage del Ticino', 'Via San Gottardo 30', 'Bellinzona', '6500', '+41 91 826 11 22', 'ticino@garage.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic','Révision générale'], 46.1940, 9.0200, 4.1, 8),
('Auto Lugano Sud', 'Via Cantonale 15', 'Lugano', '6900', '+41 91 923 45 67', 'lugano@auto.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic','Carrosserie','Électricité'], 46.0037, 8.9510, 4.3, 17),

-- Graubünden
('Garage des Grisons', 'Poststrasse 8', 'Chur', '7000', '+41 81 252 33 44', 'grisons@garage.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic','Révision générale','Suspension'], 46.8500, 9.5330, 4.0, 6),

-- Thurgau
('Garage Frauenfeld Auto', 'Hauptstrasse 20', 'Frauenfeld', '8500', '+41 52 721 11 22', 'frauenfeld@auto.ch', ARRAY['Vidange','Freinage','Pneus','Diagnostic'], 47.5540, 8.8980, 3.7, 3)
ON CONFLICT DO NOTHING;
