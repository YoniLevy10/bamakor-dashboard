"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function TicketsPage() {
  const supabase = createClient()

  const [tickets, setTickets] = useState([])
  const [workers, setWorkers] = useState([])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data: ticketsData } = await supabase
      .from("tickets")
      .select("*, projects(name, project_code), workers(full_name)")

    const { data: workersData } = await supabase
      .from("workers")
      .select("*")

    setTickets(ticketsData || [])
    setWorkers(workersData || [])
  }

  async function assignWorker(ticketId: string, workerId: string) {
    await supabase
      .from("tickets")
      .update({ assigned_worker_id: workerId, status: "assigned" })
      .eq("id", ticketId)

    fetchData()
  }

  async function closeTicket(ticketId: string) {
    await supabase
      .from("tickets")
      .update({ status: "closed" })
      .eq("id", ticketId)

    fetchData()
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Tickets</h1>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Ticket</th>
              <th className="p-3 text-left">Project</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Assign</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {tickets.map((ticket: any) => (
              <tr key={ticket.id} className="border-t">
                <td className="p-3">{ticket.ticket_number}</td>

                <td className="p-3">
                  {ticket.projects?.project_code}
                </td>

                <td className="p-3">
                  <span className="px-2 py-1 rounded bg-gray-200">
                    {ticket.status}
                  </span>
                </td>

                <td className="p-3">
                  <select
                    onChange={(e) =>
                      assignWorker(ticket.id, e.target.value)
                    }
                    className="border rounded p-1"
                  >
                    <option value="">Assign</option>
                    {workers.map((w: any) => (
                      <option key={w.id} value={w.id}>
                        {w.full_name}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="p-3">
                  <button
                    onClick={() => closeTicket(ticket.id)}
                    className="bg-green-500 text-white px-3 py-1 rounded"
                  >
                    Close
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
