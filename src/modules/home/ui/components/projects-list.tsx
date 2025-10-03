"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DeleteConfirmationModal } from "@/components/ui/delete-confirmation-modal";
import { useTRPC } from "@/trpc/client";

const ProjectsList = () => {
  const { user } = useUser();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: projects } = useQuery(trpc.projects.getMany.queryOptions());

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6); // Show 6 projects per page
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    projectId: string;
    projectName: string;
  }>({
    open: false,
    projectId: "",
    projectName: "",
  });

  const deleteProject = useMutation(
    trpc.projects.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.projects.getMany.queryOptions());
        toast.success("Projeto excluído com sucesso!");
        setDeleteModal({ open: false, projectId: "", projectName: "" });
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao excluir projeto");
      },
    })
  );

  const totalProjects = projects?.length || 0;
  const totalPages = Math.ceil(totalProjects / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProjects = projects?.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleDeleteClick = (projectId: string, projectName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteModal({
      open: true,
      projectId,
      projectName,
    });
  };

  const handleConfirmDelete = () => {
    if (deleteModal.projectId) {
      deleteProject.mutate({ id: deleteModal.projectId });
    }
  };

  // Function to generate page numbers with ellipsis
  const getPageNumbers = () => {
    const delta = 2; // Number of pages to show on each side of current page
    const range = [];
    const rangeWithDots = [];

    // Always show first page
    range.push(1);

    // Add pages around current page
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }

    // Always show last page if there's more than one page
    if (totalPages > 1) {
      range.push(totalPages);
    }

    // Remove duplicates and sort
    const uniqueRange = [...new Set(range)].sort((a, b) => a - b);

    // Add ellipsis where needed
    let prev = 0;
    for (const page of uniqueRange) {
      if (page - prev > 1) {
        rangeWithDots.push('...');
      }
      rangeWithDots.push(page);
      prev = page;
    }

    return rangeWithDots;
  };

  return (
    <>
      <div className="w-full bg-white dark:bg-sidebar rounded-xl p-8 border flex flex-col gap-y-6 sm:gap-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Seus Projetos</h2>
          {totalProjects >= 1 && (
            <div className="text-sm text-muted-foreground">
              {totalProjects} projeto{totalProjects === 1 ? '' : 's'}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {projects?.length === 0 && (
            <div className="col-span-full text-center">
              <p className="text-sm text-muted-foreground">Nenhum projeto encontrado</p>
            </div>
          )}
          {currentProjects?.map((project) => (
            <div key={project.id} className="relative group">
              <Button
                variant="outline"
                className="font-normal h-auto justify-start w-full text-start p-4"
                asChild
              >
                <Link href={`/projects/${project.id}`}>
                  <div className="flex items-center gap-x-4">
                    <Image
                      src="/logo.svg"
                      alt="lovable-clone"
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                    <div className="flex flex-col">
                      <h3 className="truncate font-medium">{project.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(project.updatedAt, {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                </Link>
              </Button>
              
              {/* Delete button */}
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-8 h-8 p-0 bg-background hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-950/20"
                onClick={(e) => handleDeleteClick(project.id, project.name, e)}
                title="Excluir projeto"
              >
                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
              </Button>
            </div>
          ))}
        </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
          <div className="text-sm text-muted-foreground order-2 sm:order-1">
            Mostrando {startIndex + 1}-{Math.min(endIndex, totalProjects)} de {totalProjects} projetos
          </div>
          <div className="flex items-center gap-2 order-1 sm:order-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>

            {/* Page Numbers */}
            <div className="flex gap-1 max-w-xs overflow-x-auto">
              {getPageNumbers().map((page, index) => (
                page === '...' ? (
                  <span key={`ellipsis-${index}`} className="px-2 py-1 text-sm text-muted-foreground">
                    ...
                  </span>
                ) : (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(page as number)}
                    className="w-8 h-8 p-0 flex-shrink-0"
                  >
                    {page}
                  </Button>
                )
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={currentPage === totalPages}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, projectId: "", projectName: "" })}
        onConfirm={handleConfirmDelete}
        title="Excluir Projeto"
        description={`Tem certeza que deseja excluir o projeto "${deleteModal.projectName}"? Esta ação não pode ser desfeita.`}
        isLoading={deleteProject.isPending}
      />
    </>
  );
};

export { ProjectsList };
