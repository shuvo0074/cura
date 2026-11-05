-- A booking made on Cura Website, linked to the clinic appointment it created.
ALTER TABLE "serial_bookings" ADD COLUMN "appointmentId" UUID;

CREATE UNIQUE INDEX "serial_bookings_appointmentId_key" ON "serial_bookings"("appointmentId");

ALTER TABLE "serial_bookings" ADD CONSTRAINT "serial_bookings_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
