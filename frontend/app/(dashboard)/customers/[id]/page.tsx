import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CustomerControls } from "@/components/customers/customer-controls";
import { Badge, OrderStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Table, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatCount, formatDate, formatDateTime, formatINR, titleCase } from "@/lib/format";
import { ApiError, api } from "@/lib/server/api";
import type { CustomerDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Customer" };

export default function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  return (
    <>
      <Link href="/customers" className="mb-4 inline-flex items-center gap-1.5 font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft size={16} /> Customers
      </Link>
      <Suspense fallback={<TableSkeleton />}>
        <CustomerContent params={params} />
      </Suspense>
    </>
  );
}

async function CustomerContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await api.get<CustomerDetail>(`/admin/customers/${id}`).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-bold">{customer.name}</h1>
            <Badge tone={customer.isBlocked ? "danger" : "success"}>{customer.isBlocked ? "Blocked" : "Active"}</Badge>
          </div>
          <p className="text-ink-500">
            {customer.email} · {customer.phone ?? "no phone"}
            {customer.referralCode ? (
              <>
                {" "}· Referral Code: <span className="font-mono font-bold text-ink-900">{customer.referralCode}</span>
              </>
            ) : null}
            {customer.referralReceived ? (
              <>
                {" "}· Referred by:{" "}
                <Link href={`/customers/${customer.referralReceived.referrer.id}`} className="font-semibold text-brand-700 hover:underline">
                  {customer.referralReceived.referrer.name}
                </Link>
              </>
            ) : null}
            {" "}· joined {formatDate(customer.createdAt)}
          </p>
        </div>
        <CustomerControls id={customer.id} isBlocked={customer.isBlocked} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Delivered orders" value={formatCount(customer.stats.deliveredOrders)} />
        <StatCard label="Total spent" value={formatINR(customer.stats.totalSpent)} />
        <StatCard label="Coin balance" value={formatCount(customer.coinBalance)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Recent orders" className="xl:col-span-2">
          {customer.orders.length === 0 ? (
            <p className="p-5 text-ink-500">No orders yet.</p>
          ) : (
            <Table minWidth={480}>
              <THead>
                <Th>Order</Th>
                <Th>Placed</Th>
                <Th>Status</Th>
                <Th align="right">Amount</Th>
              </THead>
              <tbody>
                {customer.orders.map((order) => (
                  <Tr key={order.id}>
                    <Td>
                      <Link href={`/orders/${order.id}`} className="font-semibold hover:underline">
                        {order.orderNumber}
                      </Link>
                    </Td>
                    <Td className="text-ink-700">{formatDateTime(order.createdAt)}</Td>
                    <Td>
                      <OrderStatusBadge status={order.status} />
                    </Td>
                    <Td numeric>{formatINR(order.payable)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title="Addresses">
          <ul className="flex flex-col divide-y divide-line">
            {customer.addresses.length === 0 ? <li className="p-5 text-ink-500">No saved addresses.</li> : null}
            {customer.addresses.map((address) => (
              <li key={address.id} className="p-5 text-ink-700">
                <p className="flex items-center gap-2 font-semibold text-ink-900">
                  {address.name} <Badge>{titleCase(address.type)}</Badge> {address.isDefault ? <Badge tone="brand">Default</Badge> : null}
                </p>
                <p>
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ""}
                </p>
                <p>
                  {address.city}, {address.state} {address.pincode}
                </p>
                <p>{address.phone}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Coin history">
        {customer.coinTransactions.length === 0 ? (
          <p className="p-5 text-ink-500">No coin activity.</p>
        ) : (
          <Table minWidth={520}>
            <THead>
              <Th>Date</Th>
              <Th>Type</Th>
              <Th>Note</Th>
              <Th align="right">Amount</Th>
              <Th align="right">Balance</Th>
            </THead>
            <tbody>
              {customer.coinTransactions.map((txn) => (
                <Tr key={txn.id}>
                  <Td className="text-ink-700">{formatDateTime(txn.createdAt)}</Td>
                  <Td>{titleCase(txn.type)}</Td>
                  <Td className="text-ink-700">{txn.note ?? "—"}</Td>
                  <Td numeric className={txn.amount >= 0 ? "text-success" : "text-danger"}>
                    {txn.amount >= 0 ? "+" : ""}
                    {txn.amount}
                  </Td>
                  <Td numeric>{txn.balanceAfter}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {customer.referralsGiven && customer.referralsGiven.length > 0 ? (
        <Card title={`Referrals (${customer.referralsGiven.length})`}>
          <Table minWidth={500}>
            <THead>
              <Th>Referee</Th>
              <Th>Date</Th>
              <Th>Status</Th>
              <Th align="right">Coins</Th>
            </THead>
            <tbody>
              {customer.referralsGiven.map((ref) => (
                <Tr key={ref.id}>
                  <Td>
                    <Link href={`/customers/${ref.referee.id}`} className="font-semibold hover:underline">
                      {ref.referee.name}
                    </Link>{" "}
                    <span className="text-xs text-ink-500">({ref.referee.email})</span>
                  </Td>
                  <Td className="text-ink-700">{formatDateTime(ref.createdAt)}</Td>
                  <Td>
                    <Badge tone={ref.status === "COMPLETED" ? "success" : ref.status === "PENDING" ? "brand" : "danger"}>
                      {titleCase(ref.status)}
                    </Badge>
                  </Td>
                  <Td numeric>{ref.status === "COMPLETED" ? `+${ref.referrerCoins}` : "—"}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
