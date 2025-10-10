import AdminProductForm from '../AdminProductForm';

export default function AdminProductFormExample() {
  return (
    <div className="max-w-2xl p-6">
      <AdminProductForm
        onSubmit={(data) => console.log('Product saved:', data)}
        onCancel={() => console.log('Cancelled')}
      />
    </div>
  );
}
